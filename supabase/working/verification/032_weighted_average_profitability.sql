DO $$
BEGIN
  IF to_regclass('working.inventory_costing_runs') IS NULL
     OR to_regclass('working.inventory_cost_events') IS NULL
     OR to_regclass('working.purchase_cost_sources') IS NULL
     OR to_regclass('working.sale_revenue_sources') IS NULL THEN
    RAISE EXCEPTION 'Profitability costing relations are missing';
  END IF;
  IF has_table_privilege('authenticated', 'working.inventory_cost_events', 'INSERT') THEN
    RAISE EXCEPTION 'Authenticated role can bypass the costing engine';
  END IF;
  IF NOT has_function_privilege('authenticated', 'working.get_profitability_report(date,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Profitability report permission is missing';
  END IF;
  IF (SELECT enabled_modules ->> 'profitability' FROM working.business_preferences WHERE id = 1) <> 'true' THEN
    RAISE EXCEPTION 'Profitability module is not enabled';
  END IF;
END;
$$;
