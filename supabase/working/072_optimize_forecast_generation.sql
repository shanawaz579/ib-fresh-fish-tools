-- Keep forecast generation within the API statement timeout by calculating the
-- seven-day item and customer plans in set-based queries.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_forecast_model_performance_selected_variant
  ON working.forecast_model_performance(item_variant_id)
  WHERE is_selected;

CREATE OR REPLACE FUNCTION working.generate_harvest_forecast_v2(
  p_start_date DATE DEFAULT CURRENT_DATE + 1
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  v_run_id BIGINT;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can generate a harvest forecast' USING ERRCODE = '42501';
  END IF;
  IF p_start_date < CURRENT_DATE - 1 THEN
    RAISE EXCEPTION 'Forecast start date cannot be in the past';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM working.forecast_model_performance WHERE is_selected) THEN
    PERFORM working.refresh_forecast_model_performance(NULL);
  END IF;

  INSERT INTO working.forecast_runs (start_date, end_date, generated_by)
  VALUES (p_start_date, p_start_date + 6, auth.uid())
  ON CONFLICT (start_date) DO UPDATE
    SET end_date = EXCLUDED.end_date,
        model_version = 'backtested-weekday-v2',
        status = 'ready',
        generated_at = NOW(),
        generated_by = auth.uid()
  RETURNING id INTO v_run_id;

  -- Recomputed rows are replaced in bulk. Proprietor overrides remain and are
  -- updated below without changing their final quantity.
  DELETE FROM working.forecast_recommendations
  WHERE run_id = v_run_id AND NOT is_overridden;

  WITH
  forecast_dates AS (
    SELECT day::DATE AS forecast_date,
      coalesce(event.demand_multiplier, 1)::NUMERIC AS multiplier
    FROM generate_series(p_start_date, p_start_date + 6, '1 day') day
    LEFT JOIN working.forecast_calendar_events event
      ON event.event_date = day::DATE AND event.is_confirmed
  ),
  active_variants AS (
    SELECT variant.id AS item_variant_id
    FROM working.item_variants variant
    JOIN working.item_grades grade ON grade.id = variant.grade_id
    WHERE variant.is_active AND grade.is_active
  ),
  history_grid AS (
    SELECT date.forecast_date, date.multiplier, variant.item_variant_id,
      prior.weight,
      coalesce(demand.quantity_crates, 0)::NUMERIC AS day_crates
    FROM forecast_dates date
    CROSS JOIN active_variants variant
    CROSS JOIN LATERAL generate_series(
      date.forecast_date - 56, date.forecast_date - 7, '7 days'
    ) WITH ORDINALITY prior(prior_date, weight)
    LEFT JOIN working.forecast_daily_variant_demand demand
      ON demand.sale_date = prior.prior_date::DATE
     AND demand.item_variant_id = variant.item_variant_id
  ),
  statistics AS (
    SELECT forecast_date, multiplier, item_variant_id,
      avg(day_crates) AS average_baseline,
      coalesce(sum(day_crates * weight) / nullif(sum(weight), 0), 0) AS weighted_baseline,
      coalesce(stddev_pop(day_crates), 0) AS deviation,
      count(*) FILTER (WHERE day_crates > 0) AS nonzero_weeks
    FROM history_grid
    GROUP BY forecast_date, multiplier, item_variant_id
  ),
  modeled AS (
    SELECT statistics.*,
      coalesce(performance.model_name, 'weekday_average') AS model_name,
      greatest(0, least(1, 1 - coalesce(performance.wape, 1))) AS model_accuracy,
      (CASE WHEN performance.model_name = 'weekday_weighted'
        THEN weighted_baseline ELSE average_baseline END) * multiplier AS baseline
    FROM statistics
    LEFT JOIN working.forecast_model_performance performance
      ON performance.item_variant_id = statistics.item_variant_id
     AND performance.is_selected
  ),
  measured AS (
    SELECT modeled.*,
      least(1, greatest(0,
        (nonzero_weeks::NUMERIC / 8) *
        CASE WHEN baseline <= 0 THEN 0 ELSE 1 / (1 + (deviation / baseline)) END *
        (0.5 + (0.5 * model_accuracy))
      )) AS confidence
    FROM modeled
  ),
  prepared AS (
    SELECT measured.*,
      CASE WHEN baseline < 1.5 AND confidence < 0.35 THEN 0
        ELSE greatest(0, round(baseline)::INTEGER) END AS recommended,
      greatest(0, floor(baseline - (0.75 * deviation))::INTEGER) AS low_crates
    FROM measured
  )
  INSERT INTO working.forecast_recommendations (
    run_id, forecast_date, item_variant_id, baseline_crates,
    recommended_crates, low_crates, high_crates, final_crates,
    confidence_score, confidence_label, reasons, model_name, model_accuracy
  )
  SELECT v_run_id, forecast_date, item_variant_id, round(baseline, 2),
    recommended, low_crates,
    greatest(recommended, ceil(baseline + (0.75 * deviation))::INTEGER),
    recommended, round(confidence, 4),
    CASE WHEN confidence >= 0.65 THEN 'high'
         WHEN confidence >= 0.35 THEN 'medium' ELSE 'low' END,
    jsonb_build_array(
      CASE WHEN model_name = 'weekday_weighted'
        THEN 'Recent matching weekdays weighted more heavily'
        ELSE 'Average of the last 8 matching weekdays' END,
      CASE WHEN multiplier <> 1 THEN 'Confirmed calendar adjustment applied'
        ELSE 'Includes recorded customer demand' END,
      'Best of two models selected by rolling backtest'
    ), model_name, round(model_accuracy, 4)
  FROM prepared
  WHERE recommended > 0 OR EXISTS (
    SELECT 1 FROM working.forecast_recommendations existing
    WHERE existing.run_id = v_run_id
      AND existing.forecast_date = prepared.forecast_date
      AND existing.item_variant_id = prepared.item_variant_id
      AND existing.is_overridden
  )
  ON CONFLICT (run_id, forecast_date, item_variant_id) DO UPDATE
    SET baseline_crates = EXCLUDED.baseline_crates,
        recommended_crates = EXCLUDED.recommended_crates,
        low_crates = EXCLUDED.low_crates,
        high_crates = EXCLUDED.high_crates,
        final_crates = CASE WHEN working.forecast_recommendations.is_overridden
          THEN working.forecast_recommendations.final_crates ELSE EXCLUDED.final_crates END,
        confidence_score = EXCLUDED.confidence_score,
        confidence_label = EXCLUDED.confidence_label,
        reasons = EXCLUDED.reasons,
        model_name = EXCLUDED.model_name,
        model_accuracy = EXCLUDED.model_accuracy;

  RETURN v_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION working.generate_customer_harvest_forecast_v2(p_run_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  v_start_date DATE;
  v_inserted INTEGER;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can generate a customer forecast' USING ERRCODE = '42501';
  END IF;
  SELECT start_date INTO v_start_date FROM working.forecast_runs WHERE id = p_run_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Forecast run not found'; END IF;

  DELETE FROM working.forecast_customer_recommendations WHERE run_id = p_run_id;

  WITH
  forecast_dates AS (
    SELECT generate_series(v_start_date, v_start_date + 6, '1 day')::DATE AS forecast_date
  ),
  training_window AS MATERIALIZED (
    SELECT sale_date, customer_id, item_variant_id, quantity_crates
    FROM working.forecast_expanded_training_sales
    WHERE customer_id IS NOT NULL
      AND sale_date BETWEEN v_start_date - 56 AND v_start_date - 1
  ),
  combinations AS (
    SELECT DISTINCT date.forecast_date, training.customer_id, training.item_variant_id
    FROM forecast_dates date
    JOIN training_window training
      ON training.sale_date BETWEEN date.forecast_date - 56 AND date.forecast_date - 7
     AND extract(isodow FROM training.sale_date) = extract(isodow FROM date.forecast_date)
  ),
  history_grid AS (
    SELECT combination.forecast_date, combination.customer_id, combination.item_variant_id,
      prior.prior_date, coalesce(sum(training.quantity_crates), 0) AS day_crates
    FROM combinations combination
    CROSS JOIN LATERAL generate_series(
      combination.forecast_date - 56, combination.forecast_date - 7, '7 days'
    ) prior(prior_date)
    LEFT JOIN training_window training
      ON training.customer_id = combination.customer_id
     AND training.item_variant_id = combination.item_variant_id
     AND training.sale_date = prior.prior_date::DATE
    GROUP BY combination.forecast_date, combination.customer_id,
      combination.item_variant_id, prior.prior_date
  ),
  statistics AS (
    SELECT forecast_date, customer_id, item_variant_id,
      avg(day_crates) AS baseline, stddev_pop(day_crates) AS deviation,
      count(*) FILTER (WHERE day_crates > 0) AS active_weeks
    FROM history_grid
    GROUP BY forecast_date, customer_id, item_variant_id
  ),
  prepared AS (
    SELECT *, round(baseline)::INTEGER AS recommended,
      least(1, greatest(0,
        (active_weeks::NUMERIC / 8) *
        CASE WHEN baseline <= 0 THEN 0 ELSE 1 / (1 + (deviation / baseline)) END
      )) AS confidence
    FROM statistics
  )
  INSERT INTO working.forecast_customer_recommendations (
    run_id, forecast_date, customer_id, item_variant_id,
    baseline_crates, recommended_crates, low_crates, high_crates,
    confidence_score, confidence_label
  )
  SELECT p_run_id, forecast_date, customer_id, item_variant_id,
    round(baseline, 2), recommended,
    greatest(0, floor(baseline - (0.75 * deviation))::INTEGER),
    greatest(recommended, ceil(baseline + (0.75 * deviation))::INTEGER),
    round(confidence, 4),
    CASE WHEN confidence >= 0.65 THEN 'high'
         WHEN confidence >= 0.35 THEN 'medium' ELSE 'low' END
  FROM prepared
  WHERE recommended > 0 AND NOT (baseline < 1.5 AND confidence < 0.35);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION working.generate_harvest_forecast_v2(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION working.generate_customer_harvest_forecast_v2(BIGINT) TO authenticated;

COMMIT;
