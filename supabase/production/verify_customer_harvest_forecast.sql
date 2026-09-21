DO $$
BEGIN
  IF to_regclass('working.forecast_customer_recommendations') IS NULL
     OR to_regclass('working.harvest_customer_forecast_plan') IS NULL THEN
    RAISE EXCEPTION 'Customer forecast objects are missing';
  END IF;
  IF to_regprocedure('working.generate_customer_harvest_forecast(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Customer forecast function is missing';
  END IF;
END;
$$;
