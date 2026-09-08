BEGIN;

CREATE OR REPLACE FUNCTION working.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'anonymous'
    WHEN auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'packer', 'viewer')
      THEN auth.jwt() -> 'app_metadata' ->> 'role'
    ELSE 'viewer'
  END;
$$;

REVOKE ALL ON FUNCTION working.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.current_app_role() TO authenticated;

COMMENT ON FUNCTION working.current_app_role() IS
  'Returns the application role exclusively from trusted JWT app_metadata.';

COMMIT;
