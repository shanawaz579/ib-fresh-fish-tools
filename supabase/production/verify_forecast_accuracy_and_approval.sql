DO $$
BEGIN
  IF to_regclass('working.forecast_run_events') IS NULL
     OR to_regclass('working.forecast_actual_comparison') IS NULL THEN
    RAISE EXCEPTION 'Forecast approval or accuracy objects are missing';
  END IF;
  IF to_regprocedure('working.approve_harvest_forecast(bigint,text)') IS NULL
     OR to_regprocedure('working.reopen_harvest_forecast(bigint,text)') IS NULL THEN
    RAISE EXCEPTION 'Forecast approval functions are missing';
  END IF;
END;
$$;
