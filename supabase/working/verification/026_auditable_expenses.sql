BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM working.expense_categories WHERE is_active) < 8 THEN
    RAISE EXCEPTION 'Expected seeded active expense categories';
  END IF;

  IF has_table_privilege('authenticated', 'working.expenses', 'INSERT')
     OR has_table_privilege('authenticated', 'working.expenses', 'UPDATE')
     OR has_table_privilege('authenticated', 'working.expenses', 'DELETE') THEN
    RAISE EXCEPTION 'Expense writes must be restricted to guarded RPCs';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'working.record_expense(date,bigint,numeric,character varying,text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated role cannot execute record_expense';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM working.business_preferences
    WHERE id = 1 AND enabled_modules ->> 'expenses' = 'true'
  ) THEN
    RAISE EXCEPTION 'Expenses module configuration flag is missing';
  END IF;
END;
$$;

ROLLBACK;
