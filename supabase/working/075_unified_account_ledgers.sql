BEGIN;

-- Read-only account overviews and running ledgers. These functions derive
-- balances from source bills and active payments; they never mutate business data.

CREATE OR REPLACE FUNCTION working.get_customer_account_overview(
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  account_id BIGINT,
  account_name TEXT,
  total_billed NUMERIC,
  total_paid NUMERIC,
  account_balance NUMERIC,
  outstanding_amount NUMERIC,
  advance_credit NUMERIC,
  last_activity_date DATE
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = working
AS $$
  WITH bill_totals AS (
    SELECT customer_id,
      coalesce(sum(subtotal - discount), 0)::NUMERIC AS billed,
      max(bill_date) AS last_bill_date
    FROM working.bills
    WHERE bill_date <= p_as_of_date
    GROUP BY customer_id
  ), payment_totals AS (
    SELECT customer_id,
      coalesce(sum(amount), 0)::NUMERIC AS paid,
      max(payment_date) AS last_payment_date
    FROM working.payments
    WHERE payment_date <= p_as_of_date AND voided_at IS NULL
    GROUP BY customer_id
  ), balances AS (
    SELECT customer.id,
      customer.name,
      CASE WHEN customer.opening_balance_date <= p_as_of_date
        THEN coalesce(customer.opening_balance, 0) ELSE 0 END AS opening_value,
      coalesce(bill_totals.billed, 0) AS billed,
      coalesce(payment_totals.paid, 0) AS paid,
      greatest(
        bill_totals.last_bill_date,
        payment_totals.last_payment_date,
        CASE WHEN customer.opening_balance_date <= p_as_of_date THEN customer.opening_balance_date END
      ) AS activity_date
    FROM working.customers customer
    LEFT JOIN bill_totals ON bill_totals.customer_id = customer.id
    LEFT JOIN payment_totals ON payment_totals.customer_id = customer.id
    WHERE customer.is_active
  )
  SELECT id,
    name::TEXT,
    billed + greatest(opening_value, 0),
    paid + greatest(-opening_value, 0),
    opening_value + billed - paid,
    greatest(opening_value + billed - paid, 0),
    greatest(-(opening_value + billed - paid), 0),
    activity_date
  FROM balances
  ORDER BY greatest(opening_value + billed - paid, 0) DESC, name, id;
$$;

CREATE OR REPLACE FUNCTION working.get_customer_account_ledger(
  p_customer_id BIGINT,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  transaction_key TEXT,
  transaction_type TEXT,
  transaction_date DATE,
  reference TEXT,
  amount NUMERIC,
  direction TEXT,
  balance_after NUMERIC,
  bill_id BIGINT,
  payment_id BIGINT,
  payment_mode TEXT,
  void_reason TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = working
AS $$
  WITH raw_entries AS (
    SELECT 'opening'::TEXT AS entry_key,
      'opening_balance'::TEXT AS entry_type,
      customer.opening_balance_date AS entry_date,
      'Opening balance'::TEXT AS entry_reference,
      abs(customer.opening_balance)::NUMERIC AS entry_amount,
      CASE WHEN customer.opening_balance >= 0 THEN 'debit' ELSE 'credit' END::TEXT AS entry_direction,
      customer.opening_balance::NUMERIC AS signed_delta,
      customer.opening_balance_date::TIMESTAMPTZ AS sort_time,
      0::BIGINT AS sort_id,
      NULL::BIGINT AS source_bill_id,
      NULL::BIGINT AS source_payment_id,
      NULL::TEXT AS source_payment_mode,
      NULL::TEXT AS source_void_reason
    FROM working.customers customer
    WHERE customer.id = p_customer_id
      AND customer.opening_balance_date IS NOT NULL
      AND customer.opening_balance_date <= p_as_of_date
      AND customer.opening_balance <> 0

    UNION ALL

    SELECT 'bill-' || bill.id,
      'bill', bill.bill_date, bill.bill_number,
      (bill.subtotal - bill.discount)::NUMERIC,
      'debit', (bill.subtotal - bill.discount)::NUMERIC,
      coalesce(bill.created_at, bill.bill_date::TIMESTAMPTZ), bill.id,
      bill.id, NULL, NULL, NULL
    FROM working.bills bill
    WHERE bill.customer_id = p_customer_id AND bill.bill_date <= p_as_of_date

    UNION ALL

    SELECT 'payment-' || payment.id,
      CASE WHEN payment.voided_at IS NULL THEN 'payment' ELSE 'voided_payment' END,
      payment.payment_date,
      coalesce(nullif(payment.reference_number, ''), 'Receipt'),
      payment.amount::NUMERIC,
      CASE WHEN payment.voided_at IS NULL THEN 'credit' ELSE 'none' END,
      CASE WHEN payment.voided_at IS NULL THEN -payment.amount ELSE 0 END::NUMERIC,
      coalesce(payment.created_at, payment.payment_date::TIMESTAMPTZ), payment.id,
      payment.bill_id, payment.id, payment.payment_method::TEXT, payment.void_reason
    FROM working.payments payment
    WHERE payment.customer_id = p_customer_id AND payment.payment_date <= p_as_of_date
  ), sequenced AS (
    SELECT raw_entries.*,
      sum(signed_delta) OVER (
        ORDER BY entry_date, sort_time, sort_id, entry_key
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS running_balance
    FROM raw_entries
  )
  SELECT entry_key, entry_type, entry_date, entry_reference, entry_amount,
    entry_direction, running_balance, source_bill_id, source_payment_id,
    source_payment_mode, source_void_reason
  FROM sequenced
  ORDER BY entry_date DESC, sort_time DESC, sort_id DESC, entry_key DESC;
$$;

CREATE OR REPLACE FUNCTION working.get_supplier_account_overview(
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  account_id BIGINT,
  account_name TEXT,
  total_billed NUMERIC,
  total_paid NUMERIC,
  account_balance NUMERIC,
  outstanding_amount NUMERIC,
  advance_credit NUMERIC,
  last_activity_date DATE
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = working
AS $$
  WITH bill_totals AS (
    SELECT supplier_id,
      coalesce(sum(total), 0)::NUMERIC AS billed,
      max(bill_date) AS last_bill_date
    FROM working.purchase_bills
    WHERE bill_date <= p_as_of_date
    GROUP BY supplier_id
  ), payment_totals AS (
    SELECT supplier_id,
      coalesce(sum(amount), 0)::NUMERIC AS paid,
      max(payment_date) AS last_payment_date
    FROM working.purchase_bill_payments
    WHERE payment_date <= p_as_of_date AND voided_at IS NULL
    GROUP BY supplier_id
  )
  SELECT supplier.id,
    supplier.name::TEXT,
    coalesce(bill_totals.billed, 0),
    coalesce(payment_totals.paid, 0),
    coalesce(bill_totals.billed, 0) - coalesce(payment_totals.paid, 0),
    greatest(coalesce(bill_totals.billed, 0) - coalesce(payment_totals.paid, 0), 0),
    greatest(coalesce(payment_totals.paid, 0) - coalesce(bill_totals.billed, 0), 0),
    greatest(bill_totals.last_bill_date, payment_totals.last_payment_date)
  FROM working.suppliers supplier
  LEFT JOIN bill_totals ON bill_totals.supplier_id = supplier.id
  LEFT JOIN payment_totals ON payment_totals.supplier_id = supplier.id
  WHERE supplier.is_active
  ORDER BY greatest(coalesce(bill_totals.billed, 0) - coalesce(payment_totals.paid, 0), 0) DESC,
    supplier.name, supplier.id;
$$;

CREATE OR REPLACE FUNCTION working.get_supplier_account_ledger(
  p_supplier_id BIGINT,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  transaction_key TEXT,
  transaction_type TEXT,
  transaction_date DATE,
  reference TEXT,
  amount NUMERIC,
  direction TEXT,
  balance_after NUMERIC,
  bill_id BIGINT,
  payment_id BIGINT,
  payment_mode TEXT,
  void_reason TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = working
AS $$
  WITH raw_entries AS (
    SELECT 'bill-' || bill.id AS entry_key,
      'bill'::TEXT AS entry_type,
      bill.bill_date AS entry_date,
      bill.bill_number::TEXT AS entry_reference,
      bill.total::NUMERIC AS entry_amount,
      'debit'::TEXT AS entry_direction,
      bill.total::NUMERIC AS signed_delta,
      coalesce(bill.created_at, bill.bill_date::TIMESTAMPTZ) AS sort_time,
      bill.id AS sort_id,
      bill.id AS source_bill_id,
      NULL::BIGINT AS source_payment_id,
      NULL::TEXT AS source_payment_mode,
      NULL::TEXT AS source_void_reason
    FROM working.purchase_bills bill
    WHERE bill.supplier_id = p_supplier_id AND bill.bill_date <= p_as_of_date

    UNION ALL

    SELECT 'payment-' || payment.id,
      CASE WHEN payment.voided_at IS NULL THEN 'payment' ELSE 'voided_payment' END,
      payment.payment_date,
      coalesce(nullif(payment.reference_number, ''), payment.bill_number_snapshot, 'Payment'),
      payment.amount::NUMERIC,
      CASE WHEN payment.voided_at IS NULL THEN 'credit' ELSE 'none' END,
      CASE WHEN payment.voided_at IS NULL THEN -payment.amount ELSE 0 END::NUMERIC,
      coalesce(payment.created_at, payment.payment_date::TIMESTAMPTZ), payment.id,
      payment.purchase_bill_id, payment.id, payment.payment_mode::TEXT, payment.void_reason
    FROM working.purchase_bill_payments payment
    WHERE payment.supplier_id = p_supplier_id AND payment.payment_date <= p_as_of_date
  ), sequenced AS (
    SELECT raw_entries.*,
      sum(signed_delta) OVER (
        ORDER BY entry_date, sort_time, sort_id, entry_key
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS running_balance
    FROM raw_entries
  )
  SELECT entry_key, entry_type, entry_date, entry_reference, entry_amount,
    entry_direction, running_balance, source_bill_id, source_payment_id,
    source_payment_mode, source_void_reason
  FROM sequenced
  ORDER BY entry_date DESC, sort_time DESC, sort_id DESC, entry_key DESC;
$$;

REVOKE ALL ON FUNCTION working.get_customer_account_overview(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION working.get_customer_account_ledger(BIGINT, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION working.get_supplier_account_overview(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION working.get_supplier_account_ledger(BIGINT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.get_customer_account_overview(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION working.get_customer_account_ledger(BIGINT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION working.get_supplier_account_overview(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION working.get_supplier_account_ledger(BIGINT, DATE) TO authenticated;

COMMIT;
