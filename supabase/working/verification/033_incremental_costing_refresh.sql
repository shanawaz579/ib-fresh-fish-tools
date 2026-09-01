DO $$
BEGIN
  IF to_regclass('working.inventory_costing_control') IS NULL THEN
    RAISE EXCEPTION 'Costing control table is missing';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgname LIKE 'costing_dirty_%' AND NOT tgisinternal) <> 8 THEN
    RAISE EXCEPTION 'Costing dirty triggers are incomplete';
  END IF;
  IF has_function_privilege('authenticated', 'working.rebuild_inventory_costing()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role can bypass incremental costing control';
  END IF;
  IF NOT has_function_privilege('authenticated', 'working.refresh_inventory_costing()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role cannot refresh costing safely';
  END IF;
END;
$$;
