BEGIN;

REVOKE ALL ON FUNCTION working.rebuild_inventory_costing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION working.mark_inventory_costing_dirty() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION working.refresh_inventory_costing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION working.refresh_inventory_costing() TO authenticated;

COMMIT;
