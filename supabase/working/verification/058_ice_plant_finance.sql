DO $$ BEGIN
  IF to_regclass('working.ice_sales') IS NULL OR to_regclass('working.ice_expenses') IS NULL OR to_regclass('working.ice_sale_payments') IS NULL
    OR to_regprocedure('working.get_ice_money_activity(date)') IS NULL OR to_regprocedure('working.get_ice_finance_summary(date,date)') IS NULL
  THEN RAISE EXCEPTION 'Ice Plant finance setup is incomplete'; END IF;
END $$;
