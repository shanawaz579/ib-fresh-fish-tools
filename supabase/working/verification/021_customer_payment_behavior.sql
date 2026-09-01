BEGIN;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"payment-verification@example.com","app_metadata":{"role":"admin"}}',
  true
);

DO $$
DECLARE
  customer_value BIGINT;
  payment_value working.payments%ROWTYPE;
  summary_value RECORD;
BEGIN
  INSERT INTO working.customers(name) VALUES ('Payment verification customer') RETURNING id INTO customer_value;

  INSERT INTO working.bills(
    bill_number, customer_id, bill_date, subtotal, total, previous_balance,
    balance_due, status, is_active
  ) VALUES (
    'VERIFY-PAYMENT-' || customer_value, customer_value, CURRENT_DATE,
    1000, 1000, 0, 1000, 'unpaid', TRUE
  );

  SELECT * INTO payment_value FROM working.record_customer_payment(
    customer_value, CURRENT_DATE, 600, 'cash', NULL, 'Verification part payment'
  );
  IF payment_value.applied_amount <> 600 OR payment_value.advance_amount <> 0 OR payment_value.balance_after <> 400 THEN
    RAISE EXCEPTION 'Part-payment calculation failed: %', row_to_json(payment_value);
  END IF;
  IF (SELECT total FROM working.bills WHERE customer_id = customer_value AND is_active) <> 400 THEN
    RAISE EXCEPTION 'Same-day active balance was not carried forward';
  END IF;

  SELECT * INTO payment_value FROM working.record_customer_payment(
    customer_value, CURRENT_DATE, 500, 'upi', 'VERIFY-' || customer_value, 'Verification overpayment'
  );
  IF payment_value.applied_amount <> 400 OR payment_value.advance_amount <> 100 OR payment_value.balance_after <> -100 THEN
    RAISE EXCEPTION 'Advance calculation failed: %', row_to_json(payment_value);
  END IF;

  SELECT * INTO summary_value FROM working.get_customer_account_summary(customer_value, CURRENT_DATE);
  IF summary_value.outstanding_amount <> 0 OR summary_value.advance_credit <> 100 THEN
    RAISE EXCEPTION 'Account summary failed: %', row_to_json(summary_value);
  END IF;

  PERFORM working.void_customer_payment(payment_value.id, 'Verification reversal');
  SELECT * INTO summary_value FROM working.get_customer_account_summary(customer_value, CURRENT_DATE);
  IF summary_value.outstanding_amount <> 400 OR summary_value.advance_credit <> 0 THEN
    RAISE EXCEPTION 'Void recalculation failed: %', row_to_json(summary_value);
  END IF;
  IF (SELECT total FROM working.bills WHERE customer_id = customer_value AND is_active) <> 400 THEN
    RAISE EXCEPTION 'Same-day void did not restore the carried balance';
  END IF;
END;
$$;

ROLLBACK;
