DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('working.close_cash_day(date,numeric,text)'::regprocedure)
  INTO function_definition;
  IF function_definition NOT LIKE '%Expected cash is negative%' THEN
    RAISE EXCEPTION 'Negative expected cash can still be closed';
  END IF;
END;
$$;
