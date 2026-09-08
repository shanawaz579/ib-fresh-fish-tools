BEGIN;

CREATE OR REPLACE FUNCTION working.revise_customer_bill(
  p_bill_id BIGINT, p_reason TEXT, p_customer_id BIGINT, p_bill_date DATE, p_items JSONB,
  p_other_charges JSONB DEFAULT '[]'::JSONB, p_discount NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL, p_payments JSONB DEFAULT '[]'::JSONB, p_mark_as_paid BOOLEAN DEFAULT FALSE
)
RETURNS working.bills
LANGUAGE plpgsql SECURITY DEFINER SET search_path = working, pg_temp AS $$
DECLARE
  target_bill working.bills%ROWTYPE;
  replacement_bill working.bills%ROWTYPE;
  new_sale working.sales%ROWTYPE;
  item JSONB;
  normalized_items JSONB := '[]'::JSONB;
  source_sale_ids BIGINT[] := ARRAY[]::BIGINT[];
  active_payment_ids BIGINT[] := ARRAY[]::BIGINT[];
  correction_id_value BIGINT;
  customer_name_value TEXT;
  variant_name_value TEXT;
  item_count INTEGER;
  distinct_variant_count INTEGER;
  reason_value TEXT := regexp_replace(btrim(coalesce(p_reason, '')), '[[:space:]]+', ' ', 'g');
BEGIN
  IF working.current_app_role() <> 'admin' THEN RAISE EXCEPTION 'Only administrators can revise customer bills' USING ERRCODE = '42501'; END IF;
  IF char_length(reason_value) < 5 THEN RAISE EXCEPTION 'Enter a correction reason of at least 5 characters'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sales item is required';
  END IF;

  SELECT * INTO target_bill FROM working.bills WHERE id = p_bill_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer bill not found'; END IF;
  IF target_bill.customer_id <> p_customer_id OR target_bill.bill_date <> p_bill_date THEN
    RAISE EXCEPTION 'A correction cannot change the customer or bill date';
  END IF;
  IF target_bill.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the latest customer bill can be revised because later bills carry its balance';
  END IF;
  PERFORM working.assert_business_day_open(target_bill.bill_date, 'sales bill correction');
  PERFORM pg_advisory_xact_lock(hashtextextended('working-customer-account:' || p_customer_id::TEXT, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('working-customer-bill:' || p_customer_id::TEXT, 0));

  SELECT count(*), count(DISTINCT (value ->> 'fish_variety_id'))
  INTO item_count, distinct_variant_count FROM jsonb_array_elements(p_items);
  IF item_count <> distinct_variant_count THEN RAISE EXCEPTION 'Each item and grade can appear only once'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF coalesce((item ->> 'quantity_crates')::INTEGER, 0) < 0
       OR coalesce((item ->> 'quantity_kg')::NUMERIC, 0) < 0
       OR (coalesce((item ->> 'quantity_crates')::INTEGER, 0) = 0 AND coalesce((item ->> 'quantity_kg')::NUMERIC, 0) = 0)
       OR coalesce((item ->> 'crate_weight')::NUMERIC, 0) <= 0
       OR coalesce((item ->> 'rate_per_kg')::NUMERIC, 0) <= 0 THEN
      RAISE EXCEPTION 'Every item requires quantity, crate weight, and selling rate';
    END IF;
    SELECT variant.name INTO variant_name_value FROM working.item_variants variant
    JOIN working.items catalog_item ON catalog_item.id = variant.item_id
    WHERE variant.id = (item ->> 'fish_variety_id')::BIGINT AND variant.is_active AND catalog_item.is_active;
    IF variant_name_value IS NULL THEN RAISE EXCEPTION 'Select an active item and grade'; END IF;
  END LOOP;

  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::BIGINT[]) INTO source_sale_ids
  FROM working.sales WHERE billed_in_bill_id = target_bill.id;
  IF cardinality(source_sale_ids) = 0 THEN RAISE EXCEPTION 'The bill has no linked source sales'; END IF;

  PERFORM 1 FROM working.payments WHERE bill_id = target_bill.id AND voided_at IS NULL ORDER BY id FOR UPDATE;
  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::BIGINT[]) INTO active_payment_ids
  FROM working.payments WHERE bill_id = target_bill.id AND voided_at IS NULL;
  SELECT name INTO customer_name_value FROM working.customers WHERE id = target_bill.customer_id;

  INSERT INTO working.bill_corrections (
    document_type, correction_action, original_bill_id, original_bill_number,
    counterparty_id, counterparty_name, bill_date, reason, original_snapshot, corrected_by
  ) VALUES (
    'customer_bill', 'revised', target_bill.id, target_bill.bill_number,
    target_bill.customer_id, customer_name_value, target_bill.bill_date, reason_value,
    jsonb_build_object(
      'bill', to_jsonb(target_bill),
      'items', coalesce((SELECT jsonb_agg(to_jsonb(row_value) ORDER BY row_value.id) FROM working.bill_items row_value WHERE row_value.bill_id = target_bill.id), '[]'::JSONB),
      'sale_links', coalesce((SELECT jsonb_agg(to_jsonb(link) ORDER BY link.bill_item_id, link.sale_id) FROM working.bill_item_sales link JOIN working.bill_items bill_item ON bill_item.id = link.bill_item_id WHERE bill_item.bill_id = target_bill.id), '[]'::JSONB),
      'source_sales', coalesce((SELECT jsonb_agg(to_jsonb(sale) ORDER BY sale.id) FROM working.sales sale WHERE sale.id = ANY(source_sale_ids)), '[]'::JSONB),
      'other_charges', coalesce((SELECT jsonb_agg(to_jsonb(charge) ORDER BY charge.id) FROM working.bill_other_charges charge WHERE charge.bill_id = target_bill.id), '[]'::JSONB),
      'payments', coalesce((SELECT jsonb_agg(to_jsonb(payment) ORDER BY payment.id) FROM working.payments payment WHERE payment.bill_id = target_bill.id), '[]'::JSONB)
    ), auth.uid()
  ) RETURNING id INTO correction_id_value;

  UPDATE working.payments SET bill_id = NULL WHERE id = ANY(active_payment_ids);
  PERFORM set_config('working.bill_correction_context', 'bills:' || target_bill.id::TEXT, TRUE);
  IF working.delete_customer_bill(target_bill.id) IS NOT TRUE THEN RAISE EXCEPTION 'Customer bill could not be prepared for revision'; END IF;
  DELETE FROM working.sales WHERE id = ANY(source_sale_ids);

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT name INTO variant_name_value FROM working.item_variants WHERE id = (item ->> 'fish_variety_id')::BIGINT;
    INSERT INTO working.sales (customer_id, fish_variety_id, quantity_crates, quantity_kg, sale_date, billing_status)
    VALUES (p_customer_id, (item ->> 'fish_variety_id')::BIGINT,
      coalesce((item ->> 'quantity_crates')::INTEGER, 0), coalesce((item ->> 'quantity_kg')::NUMERIC, 0),
      p_bill_date, 'unbilled') RETURNING * INTO new_sale;
    normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
      'sale_ids', jsonb_build_array(new_sale.id), 'fish_variety_id', new_sale.fish_variety_id,
      'fish_variety_name', variant_name_value, 'quantity_crates', new_sale.quantity_crates,
      'quantity_kg', new_sale.quantity_kg, 'crate_weight', (item ->> 'crate_weight')::NUMERIC,
      'rate_per_crate', 0, 'rate_per_kg', (item ->> 'rate_per_kg')::NUMERIC
    ));
  END LOOP;

  SELECT * INTO replacement_bill FROM working.create_customer_bill(
    p_customer_id, p_bill_date, normalized_items, p_other_charges, p_discount,
    p_notes, p_payments, p_mark_as_paid, NULL
  );
  UPDATE working.bills SET bill_number = target_bill.bill_number WHERE id = replacement_bill.id RETURNING * INTO replacement_bill;
  UPDATE working.payments SET bill_id = replacement_bill.id WHERE id = ANY(active_payment_ids);
  UPDATE working.bill_corrections SET replacement_bill_id = replacement_bill.id,
    replacement_bill_number = replacement_bill.bill_number WHERE id = correction_id_value;
  RETURN replacement_bill;
END;
$$;

REVOKE ALL ON FUNCTION working.revise_customer_bill(BIGINT, TEXT, BIGINT, DATE, JSONB, JSONB, NUMERIC, TEXT, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.revise_customer_bill(BIGINT, TEXT, BIGINT, DATE, JSONB, JSONB, NUMERIC, TEXT, JSONB, BOOLEAN) TO authenticated;
COMMENT ON FUNCTION working.revise_customer_bill(BIGINT, TEXT, BIGINT, DATE, JSONB, JSONB, NUMERIC, TEXT, JSONB, BOOLEAN) IS
  'Atomically revises sales sources and a finalized customer bill, retaining payments and immutable correction history.';

COMMIT;
