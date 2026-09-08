DO $$
BEGIN
  IF to_regprocedure('working.revise_customer_bill(bigint,text,bigint,date,jsonb,jsonb,numeric,text,jsonb,boolean)') IS NULL THEN
    RAISE EXCEPTION 'Full sales bill revision RPC is missing';
  END IF;
  IF NOT has_function_privilege('authenticated', 'working.revise_customer_bill(bigint,text,bigint,date,jsonb,jsonb,numeric,text,jsonb,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users cannot revise customer bills';
  END IF;
END;
$$;
