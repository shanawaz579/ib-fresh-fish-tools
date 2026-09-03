BEGIN;

DO $$
DECLARE
  customer_id_value BIGINT;
  bill_id_value BIGINT := -937001;
  direct_delete_blocked BOOLEAN := FALSE;
BEGIN
  IF to_regclass('working.bill_corrections') IS NULL THEN
    RAISE EXCEPTION 'bill_corrections table is missing';
  END IF;
  IF to_regprocedure('working.release_customer_bill_for_correction(bigint,text)') IS NULL
     OR to_regprocedure('working.revise_customer_bill(bigint,text,bigint,date,jsonb,jsonb,numeric,text,jsonb,boolean)') IS NULL
     OR to_regprocedure('working.release_purchase_bill_for_correction(bigint,text)') IS NULL THEN
    RAISE EXCEPTION 'One or more controlled correction RPCs are missing';
  END IF;
  IF has_function_privilege('authenticated', 'working.delete_customer_bill(bigint)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'working.delete_purchase_bill(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Legacy unaudited bill deletion is still executable by authenticated users';
  END IF;
  IF NOT has_function_privilege('authenticated', 'working.release_customer_bill_for_correction(bigint,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'working.revise_customer_bill(bigint,text,bigint,date,jsonb,jsonb,numeric,text,jsonb,boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'working.release_purchase_bill_for_correction(bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users cannot execute controlled correction RPCs';
  END IF;

  SELECT id INTO customer_id_value FROM working.customers ORDER BY id LIMIT 1;
  IF customer_id_value IS NULL THEN RAISE EXCEPTION 'A customer is required for verification'; END IF;

  INSERT INTO working.bills (
    id, bill_number, customer_id, bill_date, subtotal, total,
    previous_balance, balance_due, status, is_active
  ) VALUES (
    bill_id_value, 'VERIFY-CORRECTION-GUARD', customer_id_value, CURRENT_DATE,
    1, 1, 0, 1, 'unpaid', TRUE
  );

  BEGIN
    DELETE FROM working.bills WHERE id = bill_id_value;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    direct_delete_blocked := TRUE;
  END;
  IF NOT direct_delete_blocked THEN
    RAISE EXCEPTION 'Direct finalized bill deletion was not blocked';
  END IF;

  PERFORM set_config('working.bill_correction_context', 'bills:' || bill_id_value::TEXT, TRUE);
  DELETE FROM working.bills WHERE id = bill_id_value;
END;
$$;

ROLLBACK;
