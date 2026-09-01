DO $$
DECLARE
  function_definition TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'working.expenses'::regclass
      AND conname = 'expense_reference_required'
  ) THEN
    RAISE EXCEPTION 'Expense reference constraint is missing';
  END IF;

  SELECT pg_get_functiondef(
    'working.record_expense(date,bigint,numeric,character varying,text,text,text)'::regprocedure
  ) INTO function_definition;

  IF function_definition NOT LIKE '%IF reference_value IS NULL THEN%'
     OR function_definition NOT LIKE '%Reference number is required for every expense%' THEN
    RAISE EXCEPTION 'record_expense does not require references for every payment method';
  END IF;
END;
$$;
