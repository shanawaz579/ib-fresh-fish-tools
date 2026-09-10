BEGIN;

-- pgcrypto is installed in Supabase's trusted `extensions` schema. Existing
-- functions from migration 048 used a deliberately restricted search path, so
-- make that trusted schema visible to their already-deployed function bodies.
ALTER FUNCTION working.create_packing_share(DATE, BIGINT[], BOOLEAN)
  SET search_path = working, extensions, pg_temp;

ALTER FUNCTION working.get_packing_share(TEXT)
  SET search_path = working, extensions, pg_temp;

ALTER FUNCTION working.update_shared_packing_status(TEXT, BIGINT, BOOLEAN, TEXT)
  SET search_path = working, extensions, pg_temp;

COMMIT;
