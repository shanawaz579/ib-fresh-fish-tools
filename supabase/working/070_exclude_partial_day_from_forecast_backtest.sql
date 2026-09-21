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
