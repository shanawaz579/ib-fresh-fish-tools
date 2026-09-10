DO $$
DECLARE
  missing_tables TEXT[];
  missing_rls TEXT[];
  role_source TEXT;
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing_tables
  FROM unnest(ARRAY[
    'bills','bill_items','bill_corrections','business_preferences','business_profile',
    'cash_adjustments','cash_day_closings','customers','expense_categories','expenses',
    'farmers','inventory_cost_events','inventory_costing_control','inventory_costing_runs',
    'item_grades','items','item_variants','packing_share_activity','packing_share_links',
    'packing_status','payments','purchase_bill_items',
    'purchase_bill_payments','purchase_bills','purchases','sales','stock_locations',
    'stock_movements','suppliers','units'
  ]) required(name)
  WHERE to_regclass('working.' || required.name) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Missing production tables: %', missing_tables;
  END IF;

  SELECT array_agg(class.relname ORDER BY class.relname)
  INTO missing_rls
  FROM pg_class class
  JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'working' AND class.relkind = 'r' AND NOT class.relrowsecurity;

  IF missing_rls IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is disabled on: %', missing_rls;
  END IF;

  IF to_regprocedure('working.save_sales_batch(bigint,date,jsonb)') IS NULL
     OR to_regprocedure('working.revise_customer_bill(bigint,text,bigint,date,jsonb,jsonb,numeric,text,jsonb,boolean)') IS NULL
     OR to_regprocedure('working.revise_purchase_bill_with_source_changes(bigint,text,bigint,date,jsonb,numeric,numeric,character varying,text,numeric,numeric,text,text)') IS NULL
     OR to_regprocedure('working.record_customer_payment(bigint,date,numeric,character varying,text,text)') IS NULL
     OR to_regprocedure('working.create_packing_share(date,bigint[],boolean)') IS NULL
     OR to_regprocedure('working.get_packing_share(text)') IS NULL
     OR to_regprocedure('working.update_shared_packing_status(text,bigint,boolean,text)') IS NULL THEN
    RAISE EXCEPTION 'One or more critical production RPCs are missing';
  END IF;

  SELECT pg_get_functiondef('working.current_app_role()'::regprocedure) INTO role_source;
  IF role_source ILIKE '%@%' OR role_source NOT LIKE '%app_metadata%' THEN
    RAISE EXCEPTION 'Production role authorization is not hardened';
  END IF;
END;
$$;

SELECT 'production verification passed' AS result;
