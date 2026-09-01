DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'working' AND table_name = 'cash_day_closings'
      AND column_name = 'readiness_snapshot'
  ) THEN
    RAISE EXCEPTION 'Day-close readiness snapshot is missing';
  END IF;

  SELECT count(*) INTO trigger_count
  FROM pg_trigger
  WHERE tgname LIKE 'lock_day_%' AND NOT tgisinternal;
  IF trigger_count <> 14 THEN
    RAISE EXCEPTION 'Expected 14 business-day lock triggers, found %', trigger_count;
  END IF;

  IF NOT has_function_privilege('authenticated', 'working.get_day_close_readiness(date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated administrators cannot read day-close readiness';
  END IF;
  IF has_function_privilege('authenticated', 'working.assert_business_day_open(date,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'working.guard_locked_business_date()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'working.guard_locked_related_business_date()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Private day-lock functions are directly executable';
  END IF;
END;
$$;

BEGIN;

DO $$
DECLARE
  test_purchase_id BIGINT;
  test_date DATE;
  lock_blocked_change BOOLEAN := FALSE;
BEGIN
  SELECT purchase.id, purchase.purchase_date
  INTO test_purchase_id, test_date
  FROM working.purchases purchase
  WHERE NOT EXISTS (
    SELECT 1 FROM working.cash_day_closings closing
    WHERE closing.business_date = purchase.purchase_date AND closing.voided_at IS NULL
  )
  ORDER BY purchase.id
  LIMIT 1;

  IF test_purchase_id IS NULL THEN RETURN; END IF;

  INSERT INTO working.cash_day_closings (
    business_date, opening_cash, cash_received, cash_supplier_payments,
    cash_expenses, cash_adjustments_in, cash_adjustments_out,
    expected_closing_cash, counted_cash, notes, readiness_snapshot, lock_version
  ) VALUES (
    test_date, 0, 0, 0, 0, 0, 0, 0, 0,
    'Rollback-only day-lock verification', '{}'::JSONB, 2
  );

  BEGIN
    UPDATE working.purchases SET updated_at = updated_at WHERE id = test_purchase_id;
  EXCEPTION WHEN SQLSTATE '55000' THEN
    lock_blocked_change := TRUE;
  END;

  IF NOT lock_blocked_change THEN
    RAISE EXCEPTION 'Closed-day purchase mutation was not blocked';
  END IF;
END;
$$;

ROLLBACK;
