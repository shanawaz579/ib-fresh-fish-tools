BEGIN;

ALTER TABLE working.expenses
  ADD CONSTRAINT expense_reference_required
  CHECK (reference_number IS NOT NULL AND btrim(reference_number) <> '')
  NOT VALID;

CREATE OR REPLACE FUNCTION working.record_expense(
  p_expense_date DATE,
  p_category_id BIGINT,
  p_amount NUMERIC,
  p_payment_method VARCHAR,
  p_payee TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS working.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  expense_value working.expenses%ROWTYPE;
  reference_value TEXT := nullif(btrim(p_reference_number), '');
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can record expenses'
      USING ERRCODE = '42501';
  END IF;
  IF p_expense_date IS NULL OR p_expense_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Expense date cannot be in the future';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;
  IF p_payment_method NOT IN ('cash', 'bank_transfer', 'upi', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF reference_value IS NULL THEN
    RAISE EXCEPTION 'Reference number is required for every expense';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM working.expense_categories
    WHERE id = p_category_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Select an active expense category';
  END IF;

  INSERT INTO working.expenses (
    expense_date, category_id, amount, payment_method,
    payee, reference_number, notes, created_by
  ) VALUES (
    p_expense_date, p_category_id, round(p_amount, 2), p_payment_method,
    nullif(btrim(p_payee), ''), reference_value,
    nullif(btrim(p_notes), ''), auth.uid()
  ) RETURNING * INTO expense_value;

  RETURN expense_value;
END;
$$;

REVOKE ALL ON FUNCTION working.record_expense(DATE, BIGINT, NUMERIC, VARCHAR, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.record_expense(DATE, BIGINT, NUMERIC, VARCHAR, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON CONSTRAINT expense_reference_required ON working.expenses IS
  'Requires a receipt, voucher, or transaction reference for every newly recorded expense. Existing legacy rows may be backfilled before validation.';

COMMIT;
