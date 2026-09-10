DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['packing_share_links', 'packing_share_activity'] LOOP
    IF to_regclass('working.' || table_name) IS NULL THEN
      RAISE EXCEPTION 'Missing packing share table: %', table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM pg_class class
        JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
       WHERE namespace.nspname = 'working'
         AND class.relname = table_name
         AND class.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS is disabled on packing share table: %', table_name;
    END IF;
  END LOOP;

  IF to_regprocedure('working.create_packing_share(date,bigint[],boolean)') IS NULL
     OR to_regprocedure('working.get_packing_share(text)') IS NULL
     OR to_regprocedure('working.update_shared_packing_status(text,bigint,boolean,text)') IS NULL
     OR to_regprocedure('working.revoke_packing_shares(date)') IS NULL THEN
    RAISE EXCEPTION 'One or more packing share RPCs are missing';
  END IF;

  IF has_table_privilege('anon', 'working.packing_share_links', 'SELECT')
     OR has_table_privilege('anon', 'working.packing_share_activity', 'SELECT') THEN
    RAISE EXCEPTION 'Packing share tables are directly readable by anonymous users';
  END IF;
END;
$$;

SELECT 'temporary packing shares verified' AS result;
