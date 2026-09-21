DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'working'
      AND table_name = 'forecast_item_mappings'
      AND column_name = 'item_id'
  ) THEN
    RAISE EXCEPTION 'Forecast family item target is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'working'
      AND table_name = 'forecast_training_sales'
      AND column_name = 'mapping_level'
  ) THEN
    RAISE EXCEPTION 'Forecast training mapping level is missing';
  END IF;

  IF has_table_privilege('anon', 'working.forecast_training_sales', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous users must not read forecast training data';
  END IF;
END;
$$;
