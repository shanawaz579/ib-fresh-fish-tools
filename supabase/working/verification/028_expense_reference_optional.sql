DO $$
DECLARE
  function_definition TEXT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'working.expenses'::regclass
      AND conname = 'expense_reference_required'
  ) THEN
    RAISE EXCEPTION 'Expense reference constraint should not exist';
  END IF;

  SELECT pg_get_functiondef(
    'working.record_expense(date,bigint,numeric,character varying,text,text,text)'::regprocedure
  ) INTO function_definition;

  IF function_definition LIKE '%IF reference_value IS NULL THEN%'
     OR function_definition LIKE '%Reference number is required%' THEN
    RAISE EXCEPTION 'record_expense still requires a reference';
  END IF;
END;
$$;
