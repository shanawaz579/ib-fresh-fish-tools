DO $$
BEGIN
  IF to_regclass('working.forecast_runs') IS NULL
     OR to_regclass('working.forecast_recommendations') IS NULL
     OR to_regclass('working.forecast_adjustments') IS NULL THEN
    RAISE EXCEPTION 'Forecast engine tables are missing';
  END IF;
  IF to_regprocedure('working.generate_harvest_forecast(date)') IS NULL
     OR to_regprocedure('working.set_harvest_forecast_quantity(bigint,integer,text)') IS NULL THEN
    RAISE EXCEPTION 'Forecast engine functions are missing';
  END IF;
END;
$$;

SELECT
  count(*) FILTER (WHERE lower(btrim(legacy_name)) = 'jilebi' AND family_grade_codes = ARRAY['M','S']::TEXT[]) AS jilebi_ms_mappings,
  count(*) FILTER (WHERE match_status = 'confirmed') AS confirmed_item_mappings
FROM working.forecast_item_mappings;
