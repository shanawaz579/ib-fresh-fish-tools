BEGIN;

CREATE OR REPLACE FUNCTION working.close_cash_day(
  p_business_date DATE,
  p_counted_cash NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS working.cash_day_closings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  summary_value JSONB;
  closing_value working.cash_day_closings%ROWTYPE;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can close a cash day' USING ERRCODE = '42501';
  END IF;
  IF p_business_date IS NULL OR p_business_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Cash day cannot be in the future';
  END IF;
  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'Counted cash cannot be negative';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('working-cash-day:' || p_business_date::TEXT, 0));
  IF EXISTS (
    SELECT 1 FROM working.cash_day_closings
    WHERE business_date = p_business_date AND voided_at IS NULL
  ) THEN RAISE EXCEPTION 'Cash day is already closed'; END IF;
  IF EXISTS (
    SELECT 1 FROM working.cash_day_closings
    WHERE business_date > p_business_date AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A later cash day is already closed. Close days in chronological order.';
  END IF;

  summary_value := working.get_cashbook_day(p_business_date);
  IF (summary_value ->> 'expected_closing_cash')::NUMERIC < 0 THEN
    RAISE EXCEPTION 'Expected cash is negative. Record the missing opening cash or correct cash transactions before closing.';
  END IF;

  INSERT INTO working.cash_day_closings (
    business_date, opening_cash, cash_received, cash_supplier_payments,
    cash_expenses, cash_adjustments_in, cash_adjustments_out,
    expected_closing_cash, counted_cash, notes, closed_by
  ) VALUES (
    p_business_date,
    (summary_value ->> 'opening_cash')::NUMERIC,
    (summary_value ->> 'cash_received')::NUMERIC,
    (summary_value ->> 'cash_supplier_payments')::NUMERIC,
    (summary_value ->> 'cash_expenses')::NUMERIC,
    (summary_value ->> 'cash_adjustments_in')::NUMERIC,
    (summary_value ->> 'cash_adjustments_out')::NUMERIC,
    (summary_value ->> 'expected_closing_cash')::NUMERIC,
    round(p_counted_cash, 2), nullif(btrim(p_notes), ''), auth.uid()
  ) RETURNING * INTO closing_value;
  RETURN closing_value;
END;
$$;

REVOKE ALL ON FUNCTION working.close_cash_day(DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.close_cash_day(DATE, NUMERIC, TEXT) TO authenticated;

COMMIT;
