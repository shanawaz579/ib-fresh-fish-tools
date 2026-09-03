BEGIN;

CREATE OR REPLACE FUNCTION working.revise_purchase_bill_with_source_changes(
  p_purchase_bill_id BIGINT,
  p_reason TEXT,
  p_supplier_id BIGINT,
  p_bill_date DATE,
  p_items JSONB,
  p_commission_per_kg NUMERIC DEFAULT 0,
  p_payment_amount NUMERIC DEFAULT 0,
  p_payment_mode VARCHAR DEFAULT 'cash',
  p_payment_reference TEXT DEFAULT NULL,
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
  item JSONB;
  source_count INTEGER;
  submitted_count INTEGER;
  submitted_distinct_count INTEGER;
  active_payment_ids BIGINT[] := ARRAY[]::BIGINT[];
  carried_payment_total NUMERIC(14,2) := 0;
  reason_value TEXT := regexp_replace(btrim(coalesce(p_reason, '')), '[[:space:]]+', ' ', 'g');
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can revise purchase details' USING ERRCODE = '42501';
  END IF;
  IF char_length(reason_value) < 5 THEN
    RAISE EXCEPTION 'Enter a correction reason of at least 5 characters';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one purchase item is required';
  END IF;
  IF coalesce(p_payment_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Additional payment cannot be negative';
  END IF;

  SELECT * INTO target_bill
  FROM working.purchase_bills
  WHERE id = p_purchase_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase bill not found'; END IF;
  IF target_bill.supplier_id <> p_supplier_id OR target_bill.bill_date <> p_bill_date THEN
    RAISE EXCEPTION 'A correction cannot change the supplier or bill date';
  END IF;
  PERFORM working.assert_business_day_open(target_bill.bill_date, 'purchase bill correction');

  PERFORM 1
  FROM working.purchase_bill_payments
  WHERE purchase_bill_id = target_bill.id AND voided_at IS NULL
  ORDER BY id
  FOR UPDATE;

  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::BIGINT[]), coalesce(sum(amount), 0)
  INTO active_payment_ids, carried_payment_total
  FROM working.purchase_bill_payments
  WHERE purchase_bill_id = target_bill.id AND voided_at IS NULL;

  SELECT count(*) INTO source_count
  FROM working.purchases WHERE billed_in_bill_id = target_bill.id;
  SELECT count(*), count(DISTINCT (value ->> 'purchase_id'))
  INTO submitted_count, submitted_distinct_count
  FROM jsonb_array_elements(p_items);

  IF submitted_count <> source_count OR submitted_distinct_count <> source_count
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_items) submitted
       WHERE NOT EXISTS (
         SELECT 1 FROM working.purchases purchase
         WHERE purchase.id = (submitted ->> 'purchase_id')::BIGINT
           AND purchase.billed_in_bill_id = target_bill.id
       )
     ) THEN
    RAISE EXCEPTION 'A correction must retain every original purchase line exactly once';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF coalesce((item ->> 'quantity_crates')::INTEGER, 0) < 0
       OR coalesce((item ->> 'quantity_kg')::NUMERIC, 0) < 0
       OR (
         coalesce((item ->> 'quantity_crates')::INTEGER, 0) = 0
         AND coalesce((item ->> 'quantity_kg')::NUMERIC, 0) = 0
       ) THEN
      RAISE EXCEPTION 'Each corrected item requires crates, kilograms, or both';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM working.item_variants
      WHERE id = (item ->> 'fish_variety_id')::BIGINT AND is_active
    ) THEN
      RAISE EXCEPTION 'Select an active item and grade for every corrected line';
    END IF;
  END LOOP;

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
        SELECT jsonb_agg(to_jsonb(bill_item) ORDER BY bill_item.id)
        FROM working.purchase_bill_items bill_item
        WHERE bill_item.purchase_bill_id = target_bill.id
      ), '[]'::JSONB),
      'source_purchases', coalesce((
        SELECT jsonb_agg(to_jsonb(purchase) ORDER BY purchase.id)
        FROM working.purchases purchase
        WHERE purchase.billed_in_bill_id = target_bill.id
      ), '[]'::JSONB),
      'payments', coalesce((
        SELECT jsonb_agg(to_jsonb(payment) ORDER BY payment.id)
        FROM working.purchase_bill_payments payment
        WHERE payment.purchase_bill_id = target_bill.id
      ), '[]'::JSONB)
    ),
    auth.uid()
  ) RETURNING id INTO correction_id_value;

  -- Detach valid payments without voiding them. The transaction will roll back
  -- this step if the corrected bill cannot be created or cannot cover them.
  UPDATE working.purchase_bill_payments
  SET purchase_bill_id = NULL
  WHERE id = ANY(active_payment_ids);

  PERFORM set_config(
    'working.bill_correction_context',
    'purchase_bills:' || target_bill.id::TEXT,
    TRUE
  );
  IF working.delete_purchase_bill(target_bill.id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Purchase bill could not be prepared for revision';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE working.purchases
    SET fish_variety_id = (item ->> 'fish_variety_id')::BIGINT,
        quantity_crates = coalesce((item ->> 'quantity_crates')::INTEGER, 0),
        quantity_kg = coalesce((item ->> 'quantity_kg')::NUMERIC, 0),
        updated_at = NOW()
    WHERE id = (item ->> 'purchase_id')::BIGINT;
  END LOOP;

  SELECT * INTO replacement_bill
  FROM working.create_purchase_bill(
    p_supplier_id, p_bill_date, p_items, p_commission_per_kg,
    0, p_other_charges_addition, p_other_charges_deduction,
    p_notes, p_location
  );

  IF carried_payment_total + coalesce(p_payment_amount, 0) > replacement_bill.total THEN
    RAISE EXCEPTION
      'Corrected bill total % is below retained payments %. Reduce the additional payment or record the excess as a supplier refund/credit.',
      replacement_bill.total,
      carried_payment_total + coalesce(p_payment_amount, 0);
  END IF;

  UPDATE working.purchase_bill_payments
  SET purchase_bill_id = replacement_bill.id,
      bill_number_snapshot = replacement_bill.bill_number
  WHERE id = ANY(active_payment_ids);

  IF coalesce(p_payment_amount, 0) > 0 THEN
    PERFORM working.record_purchase_bill_payment(
      replacement_bill.id, p_bill_date, p_payment_amount, p_payment_mode,
      p_payment_reference, 'Additional payment recorded with corrected bill'
    );
  END IF;

  SELECT * INTO replacement_bill
  FROM working.purchase_bills WHERE id = replacement_bill.id;

  UPDATE working.bill_corrections
  SET replacement_bill_id = replacement_bill.id,
      replacement_bill_number = replacement_bill.bill_number
  WHERE id = correction_id_value;

  RETURN replacement_bill;
END;
$$;

COMMENT ON FUNCTION working.revise_purchase_bill_with_source_changes(
  BIGINT, TEXT, BIGINT, DATE, JSONB, NUMERIC, NUMERIC, VARCHAR, TEXT, NUMERIC, NUMERIC, TEXT, TEXT
) IS 'Atomically corrects purchase/stock/bill values, carries valid supplier payments to the replacement bill, and preserves the full before-state audit.';

COMMIT;
