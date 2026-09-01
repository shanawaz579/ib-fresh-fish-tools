BEGIN;

CREATE TABLE working.inventory_costing_control (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_dirty BOOLEAN NOT NULL DEFAULT TRUE,
  dirty_since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_completed_run_id BIGINT REFERENCES working.inventory_costing_runs(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO working.inventory_costing_control (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE working.inventory_costing_control ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON working.inventory_costing_control TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON working.inventory_costing_control FROM anon, authenticated;
CREATE POLICY admin_read_inventory_costing_control ON working.inventory_costing_control
FOR SELECT TO authenticated USING (working.current_app_role() = 'admin');

CREATE OR REPLACE FUNCTION working.mark_inventory_costing_dirty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
BEGIN
  UPDATE working.inventory_costing_control
  SET is_dirty = TRUE,
      dirty_since = CASE WHEN is_dirty THEN dirty_since ELSE NOW() END,
      updated_at = NOW()
  WHERE id = 1;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER costing_dirty_purchases AFTER INSERT OR UPDATE OR DELETE ON working.purchases
FOR EACH STATEMENT EXECUTE FUNCTION working.mark_inventory_costing_dirty();
CREATE TRIGGER costing_dirty_purchase_bills AFTER INSERT OR UPDATE OR DELETE ON working.purchase_bills
FOR EACH STATEMENT EXECUTE FUNCTION working.mark_inventory_costing_dirty();
CREATE TRIGGER costing_dirty_purchase_bill_items AFTER INSERT OR UPDATE OR DELETE ON working.purchase_bill_items
FOR EACH STATEMENT EXECUTE FUNCTION working.mark_inventory_costing_dirty();
CREATE TRIGGER costing_dirty_sales AFTER INSERT OR UPDATE OR DELETE ON working.sales
FOR EACH STATEMENT EXECUTE FUNCTION working.mark_inventory_costing_dirty();
CREATE TRIGGER costing_dirty_bills AFTER INSERT OR UPDATE OR DELETE ON working.bills
FOR EACH STATEMENT EXECUTE FUNCTION working.mark_inventory_costing_dirty();
CREATE TRIGGER costing_dirty_bill_items AFTER INSERT OR UPDATE OR DELETE ON working.bill_items
FOR EACH STATEMENT EXECUTE FUNCTION working.mark_inventory_costing_dirty();
CREATE TRIGGER costing_dirty_bill_item_sales AFTER INSERT OR UPDATE OR DELETE ON working.bill_item_sales
FOR EACH STATEMENT EXECUTE FUNCTION working.mark_inventory_costing_dirty();
CREATE TRIGGER costing_dirty_bill_other_charges AFTER INSERT OR UPDATE OR DELETE ON working.bill_other_charges
FOR EACH STATEMENT EXECUTE FUNCTION working.mark_inventory_costing_dirty();

ALTER FUNCTION working.refresh_inventory_costing() RENAME TO rebuild_inventory_costing;

CREATE OR REPLACE FUNCTION working.refresh_inventory_costing()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  control_value working.inventory_costing_control%ROWTYPE;
  run_id_value BIGINT;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can refresh inventory costing' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('working-inventory-costing-refresh', 0));
  SELECT * INTO control_value FROM working.inventory_costing_control WHERE id = 1 FOR UPDATE;

  IF NOT control_value.is_dirty AND control_value.last_completed_run_id IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM working.inventory_costing_runs
       WHERE id = control_value.last_completed_run_id AND completed_at IS NOT NULL
     ) THEN
    RETURN control_value.last_completed_run_id;
  END IF;

  run_id_value := working.rebuild_inventory_costing();
  UPDATE working.inventory_costing_control
  SET is_dirty = FALSE,
      last_completed_run_id = run_id_value,
      updated_at = NOW()
  WHERE id = 1;
  RETURN run_id_value;
END;
$$;

REVOKE ALL ON FUNCTION working.mark_inventory_costing_dirty() FROM PUBLIC;
REVOKE ALL ON FUNCTION working.rebuild_inventory_costing() FROM PUBLIC;
REVOKE ALL ON FUNCTION working.refresh_inventory_costing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.refresh_inventory_costing() TO authenticated;

COMMENT ON TABLE working.inventory_costing_control IS
  'Marks costing stale after source changes so reports reuse completed snapshots until a rebuild is necessary.';

COMMIT;
