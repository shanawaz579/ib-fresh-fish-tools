SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'working'
      AND table_name = 'purchase_bill_payments'
      AND column_name = 'reference_number'
  ) AS has_reference_number,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'working'
      AND table_name = 'purchase_bill_payments'
      AND column_name = 'voided_at'
  ) AS has_void_audit,
  to_regprocedure(
    'working.record_purchase_bill_payment(bigint,date,numeric,character varying,text,text)'
  ) IS NOT NULL AS has_record_rpc,
  to_regprocedure(
    'working.void_purchase_bill_payment(bigint,text)'
  ) IS NOT NULL AS has_void_rpc,
  has_table_privilege(
    'authenticated', 'working.purchase_bill_payments', 'INSERT'
  ) AS authenticated_can_insert_directly,
  has_table_privilege(
    'authenticated', 'working.purchase_bill_payments', 'DELETE'
  ) AS authenticated_can_delete_directly;
