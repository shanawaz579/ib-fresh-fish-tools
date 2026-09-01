-- Auditable, concurrency-safe supplier payments for purchase bills.

ALTER TABLE working.purchase_bill_payments
  ADD COLUMN IF NOT EXISTS reference_number VARCHAR(120),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_bill_payment_reference
  ON working.purchase_bill_payments (
    purchase_bill_id,
    lower(btrim(reference_number))
  )
  WHERE reference_number IS NOT NULL AND voided_at IS NULL;

CREATE OR REPLACE FUNCTION working.refresh_purchase_bill_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = working
AS $$
DECLARE
  target_bill_id BIGINT;
  paid_value NUMERIC(14,2);
BEGIN
  target_bill_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.purchase_bill_id
    ELSE NEW.purchase_bill_id
  END;

  SELECT coalesce(sum(amount), 0) INTO paid_value
  FROM working.purchase_bill_payments
  WHERE purchase_bill_id = target_bill_id
    AND voided_at IS NULL;

  UPDATE working.purchase_bills
  SET amount_paid = paid_value,
      balance_due = greatest(0, total - paid_value),
      payment_status = CASE
        WHEN paid_value <= 0 THEN 'pending'
        WHEN paid_value >= total THEN 'paid'
        ELSE 'partial'
      END
  WHERE id = target_bill_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase bill not found';
  END IF;

  IF p_payment_date < target_bill.bill_date THEN
    RAISE EXCEPTION 'Payment date cannot be before the bill date';
  END IF;

  IF p_payment_date > current_date THEN
    RAISE EXCEPTION 'Payment date cannot be in the future';
  END IF;

  IF p_payment_mode <> 'cash' AND reference_value IS NULL THEN
    RAISE EXCEPTION 'Reference number is required for non-cash payments';
  END IF;

  IF p_amount > target_bill.balance_due THEN
    RAISE EXCEPTION 'Payment amount exceeds the balance due of %', target_bill.balance_due;
  END IF;

  INSERT INTO working.purchase_bill_payments (
    purchase_bill_id,
    payment_date,
    amount,
    payment_mode,
    reference_number,
    notes,
    created_by
  ) VALUES (
    p_purchase_bill_id,
    p_payment_date,
    p_amount,
    p_payment_mode,
    reference_value,
    nullif(btrim(p_notes), ''),
    auth.uid()
  )
  RETURNING * INTO created_payment;

  RETURN created_payment;
END;
$$;

CREATE OR REPLACE FUNCTION working.void_purchase_bill_payment(
  p_payment_id BIGINT,
  p_void_reason TEXT
)
RETURNS working.purchase_bill_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working
AS $$
DECLARE
  target_payment working.purchase_bill_payments%ROWTYPE;
  reason_value TEXT := nullif(btrim(p_void_reason), '');
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can void purchase bill payments';
  END IF;

  IF reason_value IS NULL THEN
    RAISE EXCEPTION 'A reason is required to void a payment';
  END IF;

  SELECT * INTO target_payment
  FROM working.purchase_bill_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF target_payment.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Payment has already been voided';
  END IF;

  PERFORM 1
  FROM working.purchase_bills
  WHERE id = target_payment.purchase_bill_id
  FOR UPDATE;

  UPDATE working.purchase_bill_payments
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = reason_value
  WHERE id = p_payment_id
  RETURNING * INTO target_payment;

  RETURN target_payment;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON working.purchase_bill_payments FROM authenticated;

REVOKE ALL ON FUNCTION working.record_purchase_bill_payment(
  BIGINT, DATE, NUMERIC, VARCHAR, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.record_purchase_bill_payment(
  BIGINT, DATE, NUMERIC, VARCHAR, TEXT, TEXT
) TO authenticated;

REVOKE ALL ON FUNCTION working.void_purchase_bill_payment(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.void_purchase_bill_payment(BIGINT, TEXT) TO authenticated;

COMMENT ON COLUMN working.purchase_bill_payments.voided_at IS
  'Voided payments remain in the audit history and do not count toward the bill balance.';
