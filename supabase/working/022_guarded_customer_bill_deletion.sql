-- Guarded customer-bill deletion with complete dependent-row cleanup.

CREATE OR REPLACE FUNCTION working.link_same_transaction_bill_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working
AS $$
BEGIN
  UPDATE working.payments
  SET bill_id = NEW.id
  WHERE customer_id = NEW.customer_id
    AND payment_date = NEW.bill_date
    AND bill_id IS NULL
    AND voided_at IS NULL
    AND created_at = transaction_timestamp()
    AND created_by IS NOT DISTINCT FROM auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_same_transaction_bill_payments ON working.bills;
CREATE TRIGGER link_same_transaction_bill_payments
AFTER INSERT ON working.bills
FOR EACH ROW EXECUTE FUNCTION working.link_same_transaction_bill_payments();

REVOKE ALL ON FUNCTION working.link_same_transaction_bill_payments() FROM PUBLIC;

CREATE OR REPLACE FUNCTION working.delete_customer_bill(p_bill_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working
AS $$
DECLARE
  deleted_bill working.bills%ROWTYPE;
  previous_bill_id BIGINT;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete customer bills';
  END IF;

  SELECT * INTO deleted_bill
  FROM working.bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF deleted_bill.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the latest bill can be deleted because later bills carry its balance';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('working-customer-account:' || deleted_bill.customer_id::TEXT, 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended('working-customer-bill:' || deleted_bill.customer_id::TEXT, 0)
  );

  IF EXISTS (
    SELECT 1 FROM working.payments
    WHERE bill_id = p_bill_id AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Void active receipts linked to this bill before deleting it';
  END IF;

  -- Sales and their stock movements remain valid business transactions. Only
  -- release them from billing so a corrected bill can be generated.
  UPDATE working.sales
  SET billing_status = 'unbilled', billed_in_bill_id = NULL
  WHERE billed_in_bill_id = p_bill_id;

  -- Cascades remove bill_items, bill_item_sales and bill_other_charges.
  -- Voided payment audit rows are retained and their bill_id becomes NULL.
  DELETE FROM working.bills WHERE id = p_bill_id;

  SELECT id INTO previous_bill_id
  FROM working.bills
  WHERE customer_id = deleted_bill.customer_id
  ORDER BY bill_date DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF previous_bill_id IS NOT NULL THEN
    UPDATE working.bills SET is_active = TRUE WHERE id = previous_bill_id;
  END IF;

  PERFORM working.refresh_customer_account_status(deleted_bill.customer_id);
  RETURN TRUE;
END;
$$;

REVOKE DELETE ON working.bills FROM authenticated;
REVOKE DELETE ON working.bill_items FROM authenticated;
REVOKE DELETE ON working.bill_item_sales FROM authenticated;
REVOKE DELETE ON working.bill_other_charges FROM authenticated;

REVOKE ALL ON FUNCTION working.delete_customer_bill(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.delete_customer_bill(BIGINT) TO authenticated;

COMMENT ON FUNCTION working.delete_customer_bill(BIGINT) IS
  'Deletes only the latest customer bill atomically, releases source sales, cascades bill details, and blocks deletion while active receipts exist.';
