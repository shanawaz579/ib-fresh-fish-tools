DO $$
BEGIN
  IF to_regprocedure(
    'working.revise_purchase_bill_with_source_changes(bigint,text,bigint,date,jsonb,numeric,numeric,character varying,text,numeric,numeric,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Purchase source-correction RPC is missing';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'working.revise_purchase_bill_with_source_changes(bigint,text,bigint,date,jsonb,numeric,numeric,character varying,text,numeric,numeric,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated administrators cannot execute purchase source corrections';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'working.revise_purchase_bill_with_payment(bigint,text,bigint,date,jsonb,numeric,numeric,character varying,text,numeric,numeric,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'The bill-only correction path remains exposed';
  END IF;
END;
$$;
