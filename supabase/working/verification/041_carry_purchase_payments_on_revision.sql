DO $$
DECLARE
  function_oid REGPROCEDURE := to_regprocedure(
    'working.revise_purchase_bill_with_source_changes(bigint,text,bigint,date,jsonb,numeric,numeric,character varying,text,numeric,numeric,text,text)'
  );
  definition TEXT;
BEGIN
  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'Purchase correction RPC is missing';
  END IF;
  SELECT pg_get_functiondef(function_oid) INTO definition;
  IF definition NOT LIKE '%active_payment_ids%'
     OR definition NOT LIKE '%bill_number_snapshot = replacement_bill.bill_number%'
     OR definition NOT LIKE '%carried_payment_total%p_payment_amount%replacement_bill.total%' THEN
    RAISE EXCEPTION 'Purchase correction RPC does not contain payment carry-forward safeguards';
  END IF;
  IF NOT has_function_privilege('authenticated', function_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated administrators cannot execute purchase corrections';
  END IF;
END;
$$;
