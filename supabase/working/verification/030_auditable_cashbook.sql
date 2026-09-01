DO $$
BEGIN
  IF to_regclass('working.cash_adjustments') IS NULL
     OR to_regclass('working.cash_day_closings') IS NULL
     OR to_regclass('working.cashbook_entries') IS NULL THEN
    RAISE EXCEPTION 'Cashbook relations are missing';
  END IF;

  IF has_table_privilege('authenticated', 'working.cash_adjustments', 'INSERT')
     OR has_table_privilege('authenticated', 'working.cash_day_closings', 'INSERT') THEN
    RAISE EXCEPTION 'Authenticated role can bypass cashbook RPCs';
  END IF;

  IF NOT has_function_privilege('authenticated', 'working.get_cashbook_day(date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'working.close_cash_day(date,numeric,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'working.reopen_cash_day(bigint,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Cashbook RPC permissions are incomplete';
  END IF;

  IF (SELECT enabled_modules ->> 'cashbook' FROM working.business_preferences WHERE id = 1) <> 'true' THEN
    RAISE EXCEPTION 'Cashbook module is not enabled';
  END IF;

  IF (SELECT count(*) FROM pg_trigger
      WHERE tgname IN (
        'guard_closed_customer_cash', 'guard_closed_supplier_cash',
        'guard_closed_expense_cash', 'guard_closed_adjustment_cash'
      ) AND NOT tgisinternal) <> 4 THEN
    RAISE EXCEPTION 'Closed-day guards are incomplete';
  END IF;
END;
$$;
