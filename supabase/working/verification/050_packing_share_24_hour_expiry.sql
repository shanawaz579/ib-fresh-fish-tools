DO $$
DECLARE
  function_source TEXT;
BEGIN
  SELECT pg_get_functiondef('working.create_packing_share(date,bigint[],boolean)'::regprocedure)
    INTO function_source;

  IF function_source NOT ILIKE '%24 hours%' THEN
    RAISE EXCEPTION 'Packing share creation does not use a 24-hour expiry';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM working.packing_share_links
     WHERE revoked_at IS NULL
       AND expires_at > NOW()
       AND expires_at IS DISTINCT FROM created_at + INTERVAL '24 hours'
  ) THEN
    RAISE EXCEPTION 'An active packing link does not have a 24-hour lifetime';
  END IF;
END;
$$;

SELECT 'packing share 24-hour expiry verified' AS result;
