-- Guarded purchase-bill deletion with retained payment audit context.

ALTER TABLE working.purchase_bill_payments
  ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES working.suppliers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS bill_number_snapshot VARCHAR(32);

UPDATE working.purchase_bill_payments payment
SET supplier_id = bill.supplier_id,
    bill_number_snapshot = bill.bill_number
FROM working.purchase_bills bill
WHERE payment.purchase_bill_id = bill.id
  AND (payment.supplier_id IS NULL OR payment.bill_number_snapshot IS NULL);

ALTER TABLE working.purchase_bill_payments
  ALTER COLUMN supplier_id SET NOT NULL,
  ALTER COLUMN purchase_bill_id DROP NOT NULL;

DO $$
DECLARE
  constraint_value TEXT;
BEGIN
  SELECT constraint_name INTO constraint_value
  FROM information_schema.table_constraints
  WHERE table_schema = 'working'
    AND table_name = 'purchase_bill_payments'
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%purchase_bill_id%'
  LIMIT 1;

  IF constraint_value IS NOT NULL THEN
    EXECUTE format('ALTER TABLE working.purchase_bill_payments DROP CONSTRAINT %I', constraint_value);
  END IF;

  ALTER TABLE working.purchase_bill_payments
    ADD CONSTRAINT purchase_bill_payments_purchase_bill_id_fkey
    FOREIGN KEY (purchase_bill_id) REFERENCES working.purchase_bills(id) ON DELETE SET NULL;
END;
$$;

CREATE OR REPLACE FUNCTION working.populate_purchase_payment_audit_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working
AS $$
BEGIN
  IF NEW.purchase_bill_id IS NULL THEN
    RAISE EXCEPTION 'Purchase bill is required when recording a payment';
  END IF;

  SELECT supplier_id, bill_number
  INTO NEW.supplier_id, NEW.bill_number_snapshot
  FROM working.purchase_bills
  WHERE id = NEW.purchase_bill_id;

  IF NEW.supplier_id IS NULL THEN RAISE EXCEPTION 'Purchase bill not found'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS populate_purchase_payment_audit_context ON working.purchase_bill_payments;
CREATE TRIGGER populate_purchase_payment_audit_context
BEFORE INSERT ON working.purchase_bill_payments
FOR EACH ROW EXECUTE FUNCTION working.populate_purchase_payment_audit_context();

REVOKE ALL ON FUNCTION working.populate_purchase_payment_audit_context() FROM PUBLIC;

CREATE OR REPLACE FUNCTION working.delete_purchase_bill(p_purchase_bill_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working
AS $$
DECLARE
  target_bill working.purchase_bills%ROWTYPE;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete purchase bills';
  END IF;

  SELECT * INTO target_bill
  FROM working.purchase_bills
  WHERE id = p_purchase_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('working-purchase-bill:' || target_bill.supplier_id::TEXT, 0)
  );

  IF EXISTS (
    SELECT 1 FROM working.purchase_bill_payments
    WHERE purchase_bill_id = p_purchase_bill_id AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Void active supplier payments linked to this bill before deleting it';
  END IF;

  -- Purchases and stock movements are the source transactions and remain.
  UPDATE working.purchases
  SET billing_status = 'unbilled', billed_in_bill_id = NULL
  WHERE billed_in_bill_id = p_purchase_bill_id;

  -- purchase_bill_items cascade; voided receipts retain supplier/bill snapshots
  -- and are detached through ON DELETE SET NULL.
  DELETE FROM working.purchase_bills WHERE id = p_purchase_bill_id;
  RETURN TRUE;
END;
$$;

REVOKE DELETE ON working.purchase_bills FROM authenticated;
REVOKE DELETE ON working.purchase_bill_items FROM authenticated;
REVOKE DELETE ON working.purchase_bill_payments FROM authenticated;

REVOKE ALL ON FUNCTION working.delete_purchase_bill(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.delete_purchase_bill(BIGINT) TO authenticated;

COMMENT ON FUNCTION working.delete_purchase_bill(BIGINT) IS
  'Deletes a purchase bill atomically, releases source purchases, cascades bill items, blocks active payments, and preserves voided receipt audit.';
