DO $$ BEGIN
  IF to_regprocedure('working.get_ice_outstanding_sales()') IS NULL THEN RAISE EXCEPTION 'Ice outstanding-sales RPC is missing'; END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN ('working.get_ice_money_activity(date)'::regprocedure,'working.get_ice_finance_summary(date,date)'::regprocedure) AND prosecdef) THEN
    RAISE EXCEPTION 'Ice finance read RPC must use invoker security';
  END IF;
END $$;
