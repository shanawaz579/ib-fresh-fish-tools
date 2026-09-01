DO $$
BEGIN
  IF has_function_privilege('authenticated', 'working.rebuild_inventory_costing()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'working.mark_inventory_costing_dirty()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role can execute private costing functions';
  END IF;
  IF NOT has_function_privilege('authenticated', 'working.refresh_inventory_costing()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role cannot execute controlled costing refresh';
  END IF;
END;
$$;
