-- Atomic, auditable customer receipts with an account-level running balance.

ALTER TABLE working.payments
  ADD COLUMN IF NOT EXISTS bill_id BIGINT REFERENCES working.bills(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (applied_amount >= 0),
  ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (advance_amount >= 0),
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

ALTER TABLE working.payments
  ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_customer_payments_active_date
  ON working.payments(customer_id, payment_date DESC, id DESC)
  WHERE voided_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_payment_reference
  ON working.payments(customer_id, payment_method, lower(btrim(reference_number)))
  WHERE reference_number IS NOT NULL AND voided_at IS NULL;

CREATE OR REPLACE FUNCTION working.get_customer_account_summary(
  p_customer_id BIGINT,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_charged NUMERIC,
  total_paid NUMERIC,
  account_balance NUMERIC,
  outstanding_amount NUMERIC,
  advance_credit NUMERIC,
  unpaid_bills_count BIGINT,
  oldest_bill_date DATE
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = working
AS $$
  WITH charges AS (
    SELECT coalesce(sum(subtotal - discount), 0)::NUMERIC AS value
    FROM working.bills
    WHERE customer_id = p_customer_id
      AND bill_date <= p_as_of_date
  ), receipts AS (
    SELECT coalesce(sum(amount), 0)::NUMERIC AS value
    FROM working.payments
    WHERE customer_id = p_customer_id
      AND payment_date <= p_as_of_date
      AND voided_at IS NULL
  ), balance AS (
    SELECT charges.value AS charged,
           receipts.value AS paid,
           charges.value - receipts.value AS value
    FROM charges, receipts
  )
  SELECT charged,
         paid,
         value,
         greatest(value, 0),
         greatest(-value, 0),
         CASE WHEN value > 0 THEN 1 ELSE 0 END::BIGINT,
         CASE WHEN value > 0 THEN (
           SELECT min(bill_date) FROM working.bills
           WHERE customer_id = p_customer_id AND bill_date <= p_as_of_date
         ) ELSE NULL END
  FROM balance;
$$;

CREATE OR REPLACE FUNCTION working.refresh_customer_account_status(p_customer_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working
AS $$
DECLARE
  balance_value NUMERIC(14,2);
BEGIN
  SELECT account_balance INTO balance_value
  FROM working.get_customer_account_summary(p_customer_id, CURRENT_DATE);

  UPDATE working.bills
  SET balance_due = greatest(coalesce(balance_value, 0), 0),
      status = CASE WHEN coalesce(balance_value, 0) <= 0 THEN 'paid' ELSE 'unpaid' END
  WHERE customer_id = p_customer_id
    AND is_active;
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
  IF p_payment_method <> 'cash' AND reference_value IS NULL THEN
    RAISE EXCEPTION 'Reference number is required for non-cash payments';
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

  -- The current billing model carries the active statement total forward. A
  -- same-day receipt is outside the next bill's date window, so include it in
  -- that carried balance now. Later-dated receipts are picked up by the bill RPC.
  IF active_bill.id IS NOT NULL AND p_payment_date = active_bill.bill_date THEN
    UPDATE working.bills
    SET total = total - p_amount
    WHERE id = active_bill.id;
  END IF;

  RETURN created_payment;
END;
$$;

CREATE OR REPLACE FUNCTION working.void_customer_payment(
  p_payment_id BIGINT,
  p_void_reason TEXT
)
RETURNS working.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working
AS $$
DECLARE
  target_payment working.payments%ROWTYPE;
  linked_bill working.bills%ROWTYPE;
  reason_value TEXT := nullif(btrim(p_void_reason), '');
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can void customer payments';
  END IF;
  IF reason_value IS NULL THEN
    RAISE EXCEPTION 'A reason is required to void a payment';
  END IF;

  SELECT * INTO target_payment
  FROM working.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF target_payment.voided_at IS NOT NULL THEN RAISE EXCEPTION 'Payment has already been voided'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('working-customer-account:' || target_payment.customer_id::TEXT, 0));

  UPDATE working.payments
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = reason_value
  WHERE id = p_payment_id
  RETURNING * INTO target_payment;

  PERFORM working.refresh_customer_account_status(target_payment.customer_id);

  IF target_payment.bill_id IS NOT NULL THEN
    SELECT * INTO linked_bill FROM working.bills WHERE id = target_payment.bill_id;
    IF linked_bill.id IS NOT NULL
       AND linked_bill.is_active
       AND target_payment.payment_date = linked_bill.bill_date THEN
      UPDATE working.bills SET total = total + target_payment.amount WHERE id = linked_bill.id;
    ELSIF linked_bill.id IS NOT NULL AND NOT linked_bill.is_active THEN
      -- A later bill already absorbed this receipt. Reverse it on the current
      -- statement so all subsequent bills carry the corrected balance.
      UPDATE working.bills
      SET total = total + target_payment.amount
      WHERE customer_id = target_payment.customer_id AND is_active;
    END IF;
  END IF;

  RETURN target_payment;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON working.payments FROM authenticated;

REVOKE ALL ON FUNCTION working.get_customer_account_summary(BIGINT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.get_customer_account_summary(BIGINT, DATE) TO authenticated;
REVOKE ALL ON FUNCTION working.refresh_customer_account_status(BIGINT) FROM PUBLIC;

REVOKE ALL ON FUNCTION working.record_customer_payment(BIGINT, DATE, NUMERIC, VARCHAR, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.record_customer_payment(BIGINT, DATE, NUMERIC, VARCHAR, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION working.void_customer_payment(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.void_customer_payment(BIGINT, TEXT) TO authenticated;

-- The atomic bill RPC is the only other path allowed to insert same-day receipts.
ALTER FUNCTION working.create_customer_bill(BIGINT, DATE, JSONB, JSONB, NUMERIC, TEXT, JSONB, BOOLEAN, BIGINT)
  SECURITY DEFINER;

COMMENT ON COLUMN working.payments.advance_amount IS
  'Part of the receipt that exceeded the customer balance when it was recorded.';
COMMENT ON COLUMN working.payments.voided_at IS
  'Voided receipts remain visible for audit and are excluded from account balances.';
