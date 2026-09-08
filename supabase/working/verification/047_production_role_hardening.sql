DO $$
DECLARE
  function_source TEXT;
BEGIN
  SELECT pg_get_functiondef('working.current_app_role()'::regprocedure) INTO function_source;
  IF function_source ILIKE '%@%' OR function_source NOT LIKE '%app_metadata%' THEN
    RAISE EXCEPTION 'Role function still contains an identity fallback or lacks app_metadata authorization';
  END IF;
END;
$$;
