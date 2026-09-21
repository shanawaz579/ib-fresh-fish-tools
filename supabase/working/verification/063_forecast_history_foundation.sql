DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'forecast_import_batches',
    'forecast_customer_mappings',
    'forecast_item_mappings',
    'forecast_sales_history'
  ] LOOP
    IF to_regclass('working.' || target_table) IS NULL THEN
      RAISE EXCEPTION 'Missing forecast table: %', target_table;
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('working.' || target_table)::regclass) THEN
      RAISE EXCEPTION 'RLS is not enabled for working.%', target_table;
    END IF;
  END LOOP;

  IF to_regclass('working.forecast_training_sales') IS NULL THEN
    RAISE EXCEPTION 'Forecast training view is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'working'
      AND tablename = 'forecast_sales_history'
      AND policyname = 'admin_access'
  ) THEN
    RAISE EXCEPTION 'Forecast history admin policy is missing';
  END IF;

  IF has_table_privilege('anon', 'working.forecast_sales_history', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous users must not read forecast history';
  END IF;

  IF has_table_privilege('anon', 'working.forecast_training_sales', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous users must not read forecast training data';
  END IF;
END;
$$;

SELECT
  (SELECT count(*) FROM working.forecast_import_batches) AS import_batches,
  (SELECT count(*) FROM working.forecast_sales_history) AS historical_rows,
  (SELECT count(*) FROM working.forecast_customer_mappings WHERE match_status = 'confirmed') AS confirmed_customers,
  (SELECT count(*) FROM working.forecast_item_mappings WHERE match_status = 'confirmed') AS confirmed_items;
