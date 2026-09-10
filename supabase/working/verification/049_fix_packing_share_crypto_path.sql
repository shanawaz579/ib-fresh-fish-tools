DO $$
DECLARE
  function_name TEXT;
  configured_path TEXT;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'working.create_packing_share(date,bigint[],boolean)',
    'working.get_packing_share(text)',
    'working.update_shared_packing_status(text,bigint,boolean,text)'
  ] LOOP
    SELECT array_to_string(proconfig, ',')
      INTO configured_path
      FROM pg_proc
     WHERE oid = function_name::regprocedure;

    IF configured_path NOT LIKE '%search_path=working, extensions, pg_temp%' THEN
      RAISE EXCEPTION 'pgcrypto search path is missing from %', function_name;
    END IF;
  END LOOP;

  PERFORM extensions.gen_random_bytes(24);
  PERFORM extensions.digest('packing-share-check', 'sha256');
END;
$$;

SELECT 'packing share crypto path verified' AS result;
