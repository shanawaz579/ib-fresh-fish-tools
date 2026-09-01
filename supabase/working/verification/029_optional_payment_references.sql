DO $$
DECLARE
  purchase_definition TEXT;
  customer_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'working.record_purchase_bill_payment(bigint,date,numeric,character varying,text,text)'::regprocedure
  ) INTO purchase_definition;
  SELECT pg_get_functiondef(
    'working.record_customer_payment(bigint,date,numeric,character varying,text,text)'::regprocedure
  ) INTO customer_definition;

  IF purchase_definition LIKE '%Reference number is required%'
     OR purchase_definition LIKE '%reference_value IS NULL%' THEN
    RAISE EXCEPTION 'Purchase payment reference is still mandatory';
  END IF;
  IF customer_definition LIKE '%Reference number is required%'
     OR customer_definition LIKE '%reference_value IS NULL%' THEN
    RAISE EXCEPTION 'Customer payment reference is still mandatory';
  END IF;
END;
$$;
