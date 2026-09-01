BEGIN;

CREATE OR REPLACE FUNCTION working.record_purchase_bill_payment(
  p_purchase_bill_id BIGINT,
  p_payment_date DATE,
  p_amount NUMERIC,
  p_payment_mode VARCHAR,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS working.purchase_bill_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working
AS $$
DECLARE
  target_bill working.purchase_bills%ROWTYPE;
  created_payment working.purchase_bill_payments%ROWTYPE;
  reference_value TEXT := nullif(btrim(p_reference_number), '');
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can record purchase bill payments';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  IF p_payment_mode NOT IN ('cash', 'bank_transfer', 'upi', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Invalid payment mode';
  END IF;

  SELECT * INTO target_bill
  FROM working.purchase_bills
  WHERE id = p_purchase_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase bill not found'; END IF;
  IF p_payment_date < target_bill.bill_date THEN
    RAISE EXCEPTION 'Payment date cannot be before the bill date';
  END IF;
  IF p_payment_date > current_date THEN
    RAISE EXCEPTION 'Payment date cannot be in the future';
  END IF;
  IF p_amount > target_bill.balance_due THEN
    RAISE EXCEPTION 'Payment amount exceeds the balance due of %', target_bill.balance_due;
  END IF;

  INSERT INTO working.purchase_bill_payments (
    purchase_bill_id, payment_date, amount, payment_mode,
    reference_number, notes, created_by
  ) VALUES (
    p_purchase_bill_id, p_payment_date, p_amount, p_payment_mode,
    reference_value, nullif(btrim(p_notes), ''), auth.uid()
  ) RETURNING * INTO created_payment;

  RETURN created_payment;
END;
$$;

CREATE OR REPLACE FUNCTION working.record_customer_payment(
  p_customer_id BIGINT,
  p_payment_date DATE,
  p_amount NUMERIC,
  p_payment_method VARCHAR,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS working.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working
AS $$
DECLARE
  active_bill working.bills%ROWTYPE;
  balance_before NUMERIC(14,2);
  created_payment working.payments%ROWTYPE;
  reference_value TEXT := nullif(btrim(p_reference_number), '');
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can record customer payments';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM working.customers WHERE id = p_customer_id AND is_active) THEN
    RAISE EXCEPTION 'Customer not found or inactive';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  IF p_payment_date IS NULL OR p_payment_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Payment date cannot be in the future';
  END IF;
  IF p_payment_method NOT IN ('cash', 'bank_transfer', 'upi', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('working-customer-account:' || p_customer_id::TEXT, 0));

  SELECT * INTO active_bill
  FROM working.bills
  WHERE customer_id = p_customer_id AND is_active
  FOR UPDATE;

  SELECT account_balance INTO balance_before
  FROM working.get_customer_account_summary(p_customer_id, p_payment_date);
  balance_before := coalesce(balance_before, 0);

  INSERT INTO working.payments (
    customer_id, bill_id, payment_date, amount, payment_method,
    reference_number, notes, applied_amount, advance_amount,
    balance_after, created_by
  ) VALUES (
    p_customer_id, active_bill.id, p_payment_date, p_amount, p_payment_method,
    reference_value, nullif(btrim(p_notes), ''),
    least(p_amount, greatest(balance_before, 0)),
    greatest(p_amount - greatest(balance_before, 0), 0),
    balance_before - p_amount, auth.uid()
  ) RETURNING * INTO created_payment;

  PERFORM working.refresh_customer_account_status(p_customer_id);

  IF active_bill.id IS NOT NULL AND p_payment_date = active_bill.bill_date THEN
    UPDATE working.bills
    SET total = total - p_amount
    WHERE id = active_bill.id;
  END IF;

  RETURN created_payment;
END;
$$;

REVOKE ALL ON FUNCTION working.record_purchase_bill_payment(BIGINT, DATE, NUMERIC, VARCHAR, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.record_purchase_bill_payment(BIGINT, DATE, NUMERIC, VARCHAR, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION working.record_customer_payment(BIGINT, DATE, NUMERIC, VARCHAR, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.record_customer_payment(BIGINT, DATE, NUMERIC, VARCHAR, TEXT, TEXT) TO authenticated;

COMMENT ON COLUMN working.purchase_bill_payments.reference_number IS
  'Optional receipt, voucher, cheque, bank, or UPI reference supplied when useful.';
COMMENT ON COLUMN working.payments.reference_number IS
  'Optional receipt, voucher, cheque, bank, or UPI reference supplied when useful.';

COMMIT;
