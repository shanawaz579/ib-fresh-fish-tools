DO $$
BEGIN
  IF to_regprocedure('working.set_customer_opening_balance(bigint,numeric,date,text)') IS NULL THEN
    RAISE EXCEPTION 'Opening balance RPC is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'apply_opening_balance_to_first_bill' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Opening balance trigger is missing';
  END IF;
END;
$$;
