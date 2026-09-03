DO $$
BEGIN
  IF to_regprocedure(
    'working.create_purchase_bill_with_payment(bigint,date,jsonb,numeric,numeric,character varying,text,numeric,numeric,text,text)'
  ) IS NULL OR to_regprocedure(
    'working.revise_purchase_bill_with_payment(bigint,text,bigint,date,jsonb,numeric,numeric,character varying,text,numeric,numeric,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Atomic purchase bill/payment RPCs are missing';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'working.create_purchase_bill_with_payment(bigint,date,jsonb,numeric,numeric,character varying,text,numeric,numeric,text,text)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'working.revise_purchase_bill_with_payment(bigint,text,bigint,date,jsonb,numeric,numeric,character varying,text,numeric,numeric,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated administrators cannot use atomic purchase bill/payment RPCs';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'working.create_purchase_bill(bigint,date,jsonb,numeric,numeric,numeric,numeric,text,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'working.revise_purchase_bill(bigint,text,bigint,date,jsonb,numeric,numeric,numeric,numeric,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Non-atomic purchase bill write paths remain exposed';
  END IF;
END;
$$;
