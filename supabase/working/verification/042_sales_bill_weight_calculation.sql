DO $$
DECLARE
  definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'working.create_customer_bill(bigint,date,jsonb,jsonb,numeric,text,jsonb,boolean,bigint)'::regprocedure
  ) INTO definition;

  IF definition NOT LIKE '%quantity_crates%' OR definition NOT LIKE '%crate_weight%'
     OR definition NOT LIKE '%+ (item ->> ''quantity_kg'')::NUMERIC%' THEN
    RAISE EXCEPTION 'Customer bill function does not add loose kilograms to crate weight';
  END IF;
  IF definition NOT LIKE '%voided_at IS NULL%' THEN
    RAISE EXCEPTION 'Voided receipts are not excluded from bill totals';
  END IF;
  IF definition NOT LIKE '%SET bill_id = created_bill.id%' THEN
    RAISE EXCEPTION 'Receipts created with a bill are not linked to that bill';
  END IF;
END;
$$;
