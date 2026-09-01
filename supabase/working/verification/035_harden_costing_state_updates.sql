DO $$
DECLARE
  function_source TEXT;
BEGIN
  SELECT pg_get_functiondef('working.rebuild_inventory_costing()'::regprocedure)
  INTO function_source;

  IF function_source NOT LIKE '%state_known_qty%' OR
     function_source NOT LIKE '%state_known_cost%' OR
     function_source NOT LIKE '%state_unknown_qty%' THEN
    RAISE EXCEPTION 'Costing rebuild does not use isolated state variable names';
  END IF;

  IF has_function_privilege('authenticated', 'working.rebuild_inventory_costing()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users can execute the private costing rebuild directly';
  END IF;

  IF NOT has_function_privilege('authenticated', 'working.refresh_inventory_costing()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users cannot execute the controlled costing refresh';
  END IF;
END;
$$;
