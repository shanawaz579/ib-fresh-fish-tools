BEGIN;

CREATE OR REPLACE FUNCTION working.revise_purchase_bill(
  p_purchase_bill_id BIGINT,
  p_reason TEXT,
  p_supplier_id BIGINT,
  p_bill_date DATE,
  p_items JSONB,
  p_commission_per_kg NUMERIC DEFAULT 0,
  p_advance_amount NUMERIC DEFAULT 0,
  p_other_charges_addition NUMERIC DEFAULT 0,
  p_other_charges_deduction NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL
)
RETURNS working.purchase_bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  target_bill working.purchase_bills%ROWTYPE;
  supplier_name_value TEXT;
  correction_id_value BIGINT;
  replacement_bill working.purchase_bills%ROWTYPE;
  reason_value TEXT := regexp_replace(btrim(coalesce(p_reason, '')), '[[:space:]]+', ' ', 'g');
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can revise purchase bills' USING ERRCODE = '42501';
  END IF;
  IF char_length(reason_value) < 5 THEN
    RAISE EXCEPTION 'Enter a correction reason of at least 5 characters';
  END IF;

  SELECT * INTO target_bill
  FROM working.purchase_bills
  WHERE id = p_purchase_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase bill not found'; END IF;
  IF target_bill.supplier_id <> p_supplier_id OR target_bill.bill_date <> p_bill_date THEN
    RAISE EXCEPTION 'A correction cannot change the supplier or bill date';
  END IF;
  IF EXISTS (
    SELECT 1 FROM working.purchase_bill_payments
    WHERE purchase_bill_id = p_purchase_bill_id AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Void active supplier payments linked to this bill before revising it';
  END IF;

  SELECT name INTO supplier_name_value
  FROM working.suppliers WHERE id = target_bill.supplier_id;

  INSERT INTO working.bill_corrections (
    document_type, correction_action, original_bill_id, original_bill_number,
    counterparty_id, counterparty_name, bill_date, reason, original_snapshot, corrected_by
  ) VALUES (
    'purchase_bill', 'revised', target_bill.id, target_bill.bill_number,
    target_bill.supplier_id, supplier_name_value, target_bill.bill_date, reason_value,
    jsonb_build_object(
      'bill', to_jsonb(target_bill),
      'items', coalesce((
        SELECT jsonb_agg(to_jsonb(item) ORDER BY item.id)
        FROM working.purchase_bill_items item
        WHERE item.purchase_bill_id = target_bill.id
      ), '[]'::JSONB),
      'payments', coalesce((
        SELECT jsonb_agg(to_jsonb(payment) ORDER BY payment.id)
        FROM working.purchase_bill_payments payment
        WHERE payment.purchase_bill_id = target_bill.id
      ), '[]'::JSONB)
    ),
    auth.uid()
  ) RETURNING id INTO correction_id_value;

  PERFORM set_config(
    'working.bill_correction_context',
    'purchase_bills:' || target_bill.id::TEXT,
    TRUE
  );
  IF working.delete_purchase_bill(target_bill.id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Purchase bill could not be prepared for revision';
  END IF;

  SELECT * INTO replacement_bill
  FROM working.create_purchase_bill(
    p_supplier_id,
    p_bill_date,
    p_items,
    p_commission_per_kg,
    p_advance_amount,
    p_other_charges_addition,
    p_other_charges_deduction,
    p_notes,
    p_location
  );

  UPDATE working.bill_corrections
  SET replacement_bill_id = replacement_bill.id,
      replacement_bill_number = replacement_bill.bill_number
  WHERE id = correction_id_value;

  RETURN replacement_bill;
END;
$$;

REVOKE ALL ON FUNCTION working.revise_purchase_bill(
  BIGINT, TEXT, BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.revise_purchase_bill(
  BIGINT, TEXT, BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION working.revise_purchase_bill(
  BIGINT, TEXT, BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
) IS 'Atomically snapshots and replaces an unpaid purchase bill while preserving its source purchases and correction reason.';

COMMIT;
