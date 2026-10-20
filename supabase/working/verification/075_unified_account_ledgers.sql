BEGIN;

DO $$
DECLARE
  mismatch_count BIGINT;
BEGIN
  IF to_regprocedure('working.get_customer_account_overview(date)') IS NULL
     OR to_regprocedure('working.get_customer_account_ledger(bigint,date)') IS NULL
     OR to_regprocedure('working.get_supplier_account_overview(date)') IS NULL
     OR to_regprocedure('working.get_supplier_account_ledger(bigint,date)') IS NULL THEN
    RAISE EXCEPTION 'Unified account ledger functions are missing';
  END IF;

  IF NOT has_function_privilege('authenticated', 'working.get_customer_account_overview(date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'working.get_customer_account_ledger(bigint,date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'working.get_supplier_account_overview(date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'working.get_supplier_account_ledger(bigint,date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated role cannot read unified account ledgers';
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM working.get_customer_account_overview(CURRENT_DATE) overview
  CROSS JOIN LATERAL working.get_customer_account_summary(overview.account_id, CURRENT_DATE) summary
  WHERE abs(overview.account_balance - summary.account_balance) > 0.01
     OR abs(overview.total_billed - summary.total_charged) > 0.01
     OR abs(overview.total_paid - summary.total_paid) > 0.01;
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'Customer overview differs from the authoritative customer account summary for % account(s)', mismatch_count;
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM working.get_customer_account_overview(CURRENT_DATE) overview
  LEFT JOIN LATERAL (
    SELECT balance_after
    FROM working.get_customer_account_ledger(overview.account_id, CURRENT_DATE)
    LIMIT 1
  ) latest ON TRUE
  WHERE abs(overview.account_balance - coalesce(latest.balance_after, 0)) > 0.01;
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'Customer ledger closing balance mismatch for % account(s)', mismatch_count;
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM working.get_supplier_account_overview(CURRENT_DATE) overview
  WHERE abs(overview.account_balance - (
    coalesce((SELECT sum(total) FROM working.purchase_bills
      WHERE supplier_id = overview.account_id AND bill_date <= CURRENT_DATE), 0)
    - coalesce((SELECT sum(amount) FROM working.purchase_bill_payments
      WHERE supplier_id = overview.account_id AND payment_date <= CURRENT_DATE AND voided_at IS NULL), 0)
  )) > 0.01;
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'Supplier overview balance mismatch for % account(s)', mismatch_count;
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM working.get_supplier_account_overview(CURRENT_DATE) overview
  LEFT JOIN LATERAL (
    SELECT balance_after
    FROM working.get_supplier_account_ledger(overview.account_id, CURRENT_DATE)
    LIMIT 1
  ) latest ON TRUE
  WHERE abs(overview.account_balance - coalesce(latest.balance_after, 0)) > 0.01;
  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'Supplier ledger closing balance mismatch for % account(s)', mismatch_count;
  END IF;
END;
$$;

ROLLBACK;
