-- Backtested, per-item model selection for the advisory harvest plan.

BEGIN;

CREATE TABLE working.forecast_model_performance (
  item_variant_id BIGINT NOT NULL REFERENCES working.item_variants(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL CHECK (model_name IN ('weekday_average', 'weekday_weighted')),
  evaluated_days INTEGER NOT NULL CHECK (evaluated_days > 0),
  actual_crates NUMERIC(14,2) NOT NULL CHECK (actual_crates >= 0),
  absolute_error NUMERIC(14,2) NOT NULL CHECK (absolute_error >= 0),
  wape NUMERIC(8,4),
  mean_absolute_error NUMERIC(10,2) NOT NULL CHECK (mean_absolute_error >= 0),
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  evaluated_through DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_variant_id, model_name)
);

ALTER TABLE working.forecast_recommendations
  ADD COLUMN model_name TEXT NOT NULL DEFAULT 'weekday_average',
  ADD COLUMN model_accuracy NUMERIC(5,4) CHECK (model_accuracy BETWEEN 0 AND 1);

ALTER TABLE working.forecast_model_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_access ON working.forecast_model_performance FOR ALL TO authenticated
USING (working.current_app_role() = 'admin') WITH CHECK (working.current_app_role() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON working.forecast_model_performance TO authenticated;

CREATE OR REPLACE VIEW working.forecast_expanded_training_sales
WITH (security_invoker = TRUE)
AS
WITH
anchor AS (
  SELECT coalesce(max(sale_date), CURRENT_DATE) AS max_date FROM working.forecast_training_sales
),
family_configs AS (
  SELECT DISTINCT item_id, family_grade_codes
  FROM working.forecast_training_sales
  WHERE mapping_level = 'item' AND family_grade_codes IS NOT NULL
),
recent_variant_sales AS (
  SELECT training.item_variant_id, sum(training.quantity_crates)::NUMERIC AS crates
  FROM working.forecast_training_sales training, anchor
  WHERE training.source_system = 'current'
    AND training.mapping_level = 'variant'
    AND training.sale_date >= anchor.max_date - 55
  GROUP BY training.item_variant_id
),
allocation_inputs AS (
  SELECT config.item_id, config.family_grade_codes, variant.id AS item_variant_id,
    coalesce(recent.crates, 0) AS recent_crates,
    sum(coalesce(recent.crates, 0)) OVER (PARTITION BY config.item_id, config.family_grade_codes) AS family_recent_crates,
    count(*) OVER (PARTITION BY config.item_id, config.family_grade_codes) AS grade_count
  FROM family_configs config
  JOIN working.item_variants variant ON variant.item_id = config.item_id AND variant.is_active
  JOIN working.item_grades grade ON grade.id = variant.grade_id
    AND grade.code = ANY(config.family_grade_codes)
  LEFT JOIN recent_variant_sales recent ON recent.item_variant_id = variant.id
),
family_allocations AS (
  SELECT item_id, family_grade_codes, item_variant_id,
    CASE WHEN family_recent_crates > 0 THEN recent_crates / family_recent_crates
         ELSE 1::NUMERIC / grade_count END AS allocation_share
  FROM allocation_inputs
)
SELECT sale_date, customer_id, item_variant_id, quantity_crates::NUMERIC AS quantity_crates,
  source_system, source_sale_id
FROM working.forecast_training_sales
WHERE mapping_level = 'variant'

UNION ALL

SELECT training.sale_date, training.customer_id, allocation.item_variant_id,
  training.quantity_crates * allocation.allocation_share,
  training.source_system, training.source_sale_id
FROM working.forecast_training_sales training
JOIN family_allocations allocation
  ON allocation.item_id = training.item_id
 AND allocation.family_grade_codes = training.family_grade_codes
WHERE training.mapping_level = 'item';

CREATE OR REPLACE VIEW working.forecast_daily_variant_demand
WITH (security_invoker = TRUE)
AS
SELECT sale_date, item_variant_id, sum(quantity_crates) AS quantity_crates
FROM working.forecast_expanded_training_sales
GROUP BY sale_date, item_variant_id;

GRANT SELECT ON working.forecast_expanded_training_sales, working.forecast_daily_variant_demand TO authenticated;
REVOKE ALL ON working.forecast_expanded_training_sales, working.forecast_daily_variant_demand FROM anon;

CREATE OR REPLACE FUNCTION working.refresh_forecast_model_performance(p_evaluated_through DATE DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  v_through DATE;
  v_count INTEGER;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can evaluate forecast models' USING ERRCODE = '42501';
  END IF;

  SELECT least(coalesce(p_evaluated_through, max(sale_date)), CURRENT_DATE - 1) INTO v_through
  FROM working.forecast_daily_variant_demand;
  IF v_through IS NULL THEN RETURN 0; END IF;

  DELETE FROM working.forecast_model_performance;

  WITH
  evaluation_dates AS (
    SELECT generate_series(v_through - 55, v_through, '1 day')::DATE AS evaluation_date
  ),
  combinations AS (
    SELECT date.evaluation_date, variant.id AS item_variant_id
    FROM evaluation_dates date
    JOIN working.item_variants variant ON variant.is_active
    WHERE EXISTS (
      SELECT 1 FROM working.forecast_daily_variant_demand demand
      WHERE demand.item_variant_id = variant.id
        AND demand.sale_date BETWEEN date.evaluation_date - 56 AND date.evaluation_date
    )
  ),
  history_grid AS (
    SELECT combination.evaluation_date, combination.item_variant_id,
      prior.prior_date::DATE,
      row_number() OVER (
        PARTITION BY combination.evaluation_date, combination.item_variant_id
        ORDER BY prior.prior_date
      ) AS recency_weight,
      coalesce(demand.quantity_crates, 0) AS day_crates
    FROM combinations combination
    CROSS JOIN LATERAL generate_series(
      combination.evaluation_date - 56, combination.evaluation_date - 7, '7 days'
    ) prior(prior_date)
    LEFT JOIN working.forecast_daily_variant_demand demand
      ON demand.item_variant_id = combination.item_variant_id
     AND demand.sale_date = prior.prior_date::DATE
  ),
  predictions AS (
    SELECT grid.evaluation_date, grid.item_variant_id,
      avg(grid.day_crates) AS weekday_average,
      sum(grid.day_crates * grid.recency_weight) / sum(grid.recency_weight) AS weekday_weighted,
      coalesce(actual.quantity_crates, 0) AS actual
    FROM history_grid grid
    LEFT JOIN working.forecast_daily_variant_demand actual
      ON actual.item_variant_id = grid.item_variant_id
     AND actual.sale_date = grid.evaluation_date
    GROUP BY grid.evaluation_date, grid.item_variant_id, actual.quantity_crates
  ),
  errors AS (
    SELECT prediction.item_variant_id, prediction.evaluation_date, prediction.actual,
      candidate.model_name, candidate.predicted,
      abs(prediction.actual - candidate.predicted) AS absolute_error
    FROM predictions prediction
    CROSS JOIN LATERAL (VALUES
      ('weekday_average'::TEXT, prediction.weekday_average),
      ('weekday_weighted'::TEXT, prediction.weekday_weighted)
    ) candidate(model_name, predicted)
  )
  INSERT INTO working.forecast_model_performance (
    item_variant_id, model_name, evaluated_days, actual_crates,
    absolute_error, wape, mean_absolute_error, evaluated_through
  )
  SELECT item_variant_id, model_name, count(*), round(sum(actual), 2),
    round(sum(absolute_error), 2),
    CASE WHEN sum(actual) > 0 THEN round(sum(absolute_error) / sum(actual), 4) END,
    round(avg(absolute_error), 2), v_through
  FROM errors
  GROUP BY item_variant_id, model_name;

  WITH ranked AS (
    SELECT item_variant_id, model_name,
      row_number() OVER (
        PARTITION BY item_variant_id
        ORDER BY wape NULLS LAST, mean_absolute_error, model_name
      ) AS rank
    FROM working.forecast_model_performance
  )
  UPDATE working.forecast_model_performance performance
  SET is_selected = (ranked.rank = 1)
  FROM ranked
  WHERE ranked.item_variant_id = performance.item_variant_id
    AND ranked.model_name = performance.model_name;

  SELECT count(*) INTO v_count FROM working.forecast_model_performance WHERE is_selected;
  RETURN v_count;
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
  combinations AS (
    SELECT DISTINCT date.forecast_date, training.customer_id, training.item_variant_id
    FROM forecast_dates date
    JOIN working.forecast_expanded_training_sales training
      ON training.sale_date BETWEEN date.forecast_date - 56 AND date.forecast_date - 7
     AND extract(isodow FROM training.sale_date) = extract(isodow FROM date.forecast_date)
    WHERE training.customer_id IS NOT NULL
  ),
  history_grid AS (
    SELECT combination.forecast_date, combination.customer_id, combination.item_variant_id,
      prior.prior_date,
      coalesce(sum(training.quantity_crates), 0) AS day_crates
    FROM combinations combination
    CROSS JOIN LATERAL generate_series(
      combination.forecast_date - 56, combination.forecast_date - 7, '7 days'
    ) prior(prior_date)
    LEFT JOIN working.forecast_expanded_training_sales training
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

CREATE OR REPLACE VIEW working.harvest_forecast_plan
WITH (security_invoker = TRUE)
AS
SELECT
  recommendation.id,
  recommendation.run_id,
  run.start_date,
  recommendation.forecast_date,
  recommendation.item_variant_id,
  item.name AS item_name,
  grade.code AS grade_code,
  variant.name AS variant_name,
  recommendation.baseline_crates,
  recommendation.recommended_crates,
  recommendation.low_crates,
  recommendation.high_crates,
  recommendation.final_crates,
  recommendation.confidence_score,
  recommendation.confidence_label,
  recommendation.reasons,
  recommendation.is_overridden,
  recommendation.override_note,
  run.generated_at,
  recommendation.model_name,
  recommendation.model_accuracy
FROM working.forecast_recommendations recommendation
JOIN working.forecast_runs run ON run.id = recommendation.run_id
JOIN working.item_variants variant ON variant.id = recommendation.item_variant_id
JOIN working.items item ON item.id = variant.item_id
JOIN working.item_grades grade ON grade.id = variant.grade_id;

CREATE OR REPLACE VIEW working.forecast_accuracy_summary
WITH (security_invoker = TRUE)
AS
SELECT
  performance.item_variant_id,
  variant.name AS variant_name,
  performance.model_name,
  performance.evaluated_days,
  performance.wape,
  greatest(0, least(1, 1 - coalesce(performance.wape, 1))) AS accuracy,
  performance.mean_absolute_error,
  performance.evaluated_through
FROM working.forecast_model_performance performance
JOIN working.item_variants variant ON variant.id = performance.item_variant_id
WHERE performance.is_selected;

GRANT SELECT ON working.forecast_accuracy_summary TO authenticated;
REVOKE ALL ON working.forecast_accuracy_summary FROM anon;
GRANT EXECUTE ON FUNCTION working.refresh_forecast_model_performance(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION working.generate_customer_harvest_forecast_v2(BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION working.generate_harvest_forecast_v2(p_start_date DATE DEFAULT CURRENT_DATE + 1)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  v_run_id BIGINT;
  v_target_date DATE;
  v_variant RECORD;
  v_values NUMERIC[];
  v_baseline NUMERIC;
  v_weighted_baseline NUMERIC;
  v_deviation NUMERIC;
  v_nonzero_weeks INTEGER;
  v_multiplier NUMERIC;
  v_recommended INTEGER;
  v_low INTEGER;
  v_high INTEGER;
  v_confidence NUMERIC;
  v_confidence_label TEXT;
  v_model_name TEXT;
  v_model_accuracy NUMERIC;
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

  FOR v_target_date IN SELECT generate_series(p_start_date, p_start_date + 6, '1 day')::DATE LOOP
    SELECT coalesce(event.demand_multiplier, 1)
      INTO v_multiplier
    FROM (SELECT 1) anchor
    LEFT JOIN working.forecast_calendar_events event
      ON event.event_date = v_target_date AND event.is_confirmed;

    FOR v_variant IN
      SELECT variant.id, variant.item_id, grade.code AS grade_code, variant.name
      FROM working.item_variants variant
      JOIN working.item_grades grade ON grade.id = variant.grade_id
      WHERE variant.is_active AND grade.is_active
      ORDER BY variant.id
    LOOP
      -- Eight matching weekdays. The generated dates preserve zero-demand weeks.
      SELECT array_agg(coalesce(demand.quantity_crates, 0) ORDER BY prior.prior_date)
      INTO v_values
      FROM generate_series(v_target_date - 56, v_target_date - 7, '7 days') prior(prior_date)
      LEFT JOIN working.forecast_daily_variant_demand demand
        ON demand.sale_date = prior.prior_date::DATE
       AND demand.item_variant_id = v_variant.id;

      SELECT coalesce(avg(value), 0),
        coalesce(sum(value * weight) / nullif(sum(weight), 0), 0),
        coalesce(stddev_pop(value), 0), count(*) FILTER (WHERE value > 0)
      INTO v_baseline, v_weighted_baseline, v_deviation, v_nonzero_weeks
      FROM unnest(v_values) WITH ORDINALITY series(value, weight);

      SELECT performance.model_name, greatest(0, least(1, 1 - coalesce(performance.wape, 1)))
      INTO v_model_name, v_model_accuracy
      FROM working.forecast_model_performance performance
      WHERE performance.item_variant_id = v_variant.id AND performance.is_selected;
      v_model_name := coalesce(v_model_name, 'weekday_average');
      v_model_accuracy := coalesce(v_model_accuracy, 0);
      IF v_model_name = 'weekday_weighted' THEN v_baseline := v_weighted_baseline; END IF;

      v_baseline := v_baseline * v_multiplier;
      v_low := greatest(0, floor((v_baseline - (0.75 * v_deviation)))::INTEGER);
      v_confidence := least(1, greatest(0,
        (v_nonzero_weeks::NUMERIC / 8) *
        CASE WHEN v_baseline <= 0 THEN 0 ELSE 1 / (1 + (v_deviation / v_baseline)) END *
        (0.5 + (0.5 * v_model_accuracy))
      ));
      v_recommended := CASE
        WHEN v_baseline < 1.5 AND v_confidence < 0.35 THEN 0
        ELSE greatest(0, round(v_baseline)::INTEGER)
      END;
      v_high := greatest(v_recommended, ceil(v_baseline + (0.75 * v_deviation))::INTEGER);
      v_confidence_label := CASE
        WHEN v_confidence >= 0.65 THEN 'high'
        WHEN v_confidence >= 0.35 THEN 'medium'
        ELSE 'low'
      END;

      IF v_recommended > 0 OR EXISTS (
        SELECT 1 FROM working.forecast_recommendations existing
        WHERE existing.run_id = v_run_id
          AND existing.forecast_date = v_target_date
          AND existing.item_variant_id = v_variant.id
          AND existing.is_overridden
      ) THEN
        INSERT INTO working.forecast_recommendations (
          run_id, forecast_date, item_variant_id, baseline_crates,
          recommended_crates, low_crates, high_crates, final_crates,
          confidence_score, confidence_label, reasons, model_name, model_accuracy
        ) VALUES (
          v_run_id, v_target_date, v_variant.id, round(v_baseline, 2),
          v_recommended, v_low, v_high, v_recommended,
          round(v_confidence, 4), v_confidence_label,
          jsonb_build_array(
            CASE WHEN v_model_name = 'weekday_weighted'
              THEN 'Recent matching weekdays weighted more heavily'
              ELSE 'Average of the last 8 matching weekdays' END,
            CASE WHEN v_multiplier <> 1 THEN 'Confirmed calendar adjustment applied' ELSE 'Includes recorded customer demand' END,
            'Best of two models selected by rolling backtest'
          ), v_model_name, round(v_model_accuracy, 4)
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
      ELSE
        DELETE FROM working.forecast_recommendations existing
        WHERE existing.run_id = v_run_id
          AND existing.forecast_date = v_target_date
          AND existing.item_variant_id = v_variant.id
          AND NOT existing.is_overridden;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION working.generate_harvest_forecast_v2(DATE) TO authenticated;

COMMIT;
