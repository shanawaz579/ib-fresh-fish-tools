DO $$
BEGIN
  IF to_regclass('working.forecast_model_performance') IS NULL
     OR to_regclass('working.forecast_accuracy_summary') IS NULL
     OR to_regclass('working.forecast_expanded_training_sales') IS NULL THEN
    RAISE EXCEPTION 'Forecast backtesting objects are missing';
  END IF;
  IF to_regprocedure('working.refresh_forecast_model_performance(date)') IS NULL
     OR to_regprocedure('working.generate_harvest_forecast_v2(date)') IS NULL
     OR to_regprocedure('working.generate_customer_harvest_forecast_v2(bigint)') IS NULL THEN
    RAISE EXCEPTION 'Forecast v2 functions are missing';
  END IF;
END;
$$;
