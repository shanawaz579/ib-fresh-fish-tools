DO $$
BEGIN
  IF to_regprocedure(
    'working.revise_purchase_bill(bigint,text,bigint,date,jsonb,numeric,numeric,numeric,numeric,text,text)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Atomic purchase bill revision RPC is missing';
  END IF;
  IF NOT has_function_privilege(
    'authenticated',
    'working.revise_purchase_bill(bigint,text,bigint,date,jsonb,numeric,numeric,numeric,numeric,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated administrators cannot execute purchase bill revision';
  END IF;
END;
$$;
