DO $$
BEGIN
  IF to_regprocedure('working.generate_harvest_forecast_v2(date)') IS NULL
     OR to_regprocedure('working.generate_customer_harvest_forecast_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Optimized forecast functions are missing';
  END IF;
END;
$$;

SELECT id, start_date, end_date, status
FROM working.forecast_runs
ORDER BY id DESC
LIMIT 5;
