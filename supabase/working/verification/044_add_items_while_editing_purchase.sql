DO $$
BEGIN
  IF to_regprocedure('working.update_purchase_group(bigint[],jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Purchase group edit RPC is missing';
  END IF;
  IF NOT has_function_privilege('authenticated', 'working.update_purchase_group(bigint[],jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users cannot execute purchase group edits';
  END IF;
END;
$$;
