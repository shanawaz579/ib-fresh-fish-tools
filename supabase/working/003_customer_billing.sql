-- Atomic customer statement creation/replacement and deletion.

CREATE OR REPLACE FUNCTION working.create_customer_bill(
  p_customer_id BIGINT,
  p_bill_date DATE,
  p_items JSONB,
  p_other_charges JSONB DEFAULT '[]'::JSONB,
  p_discount NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_payments JSONB DEFAULT '[]'::JSONB,
  p_mark_as_paid BOOLEAN DEFAULT FALSE,
  p_replace_bill_id BIGINT DEFAULT NULL
)
RETURNS working.bills
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = working
AS $$
DECLARE
  item JSONB;
  charge JSONB;
  payment JSONB;
  sale_id_value BIGINT;
  created_item_id BIGINT;
  previous_bill working.bills%ROWTYPE;
  replaced_bill working.bills%ROWTYPE;
  created_bill working.bills%ROWTYPE;
  bill_number_value TEXT;
  items_total NUMERIC(14,2) := 0;
  charges_total NUMERIC(14,2) := 0;
  previous_balance_value NUMERIC(14,2) := 0;
  payments_total NUMERIC(14,2) := 0;
  balance_before_charges NUMERIC(14,2) := 0;
  final_total NUMERIC(14,2) := 0;
  item_amount NUMERIC(14,2);
  source_crates NUMERIC;
  source_kg NUMERIC;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can create customer bills';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one bill item is required';
  END IF;
  IF COALESCE(p_discount, 0) < 0 THEN
    RAISE EXCEPTION 'Discount cannot be negative';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('working-customer-bill:' || p_customer_id::TEXT, 0)
  );

  IF p_replace_bill_id IS NOT NULL THEN
    SELECT * INTO replaced_bill
    FROM working.bills
    WHERE id = p_replace_bill_id
      AND customer_id = p_customer_id
      AND bill_date = p_bill_date
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'The bill being edited does not match this customer/date';
    END IF;
    IF replaced_bill.is_active IS NOT TRUE THEN
      RAISE EXCEPTION 'Only the current active bill can be edited';
    END IF;

    UPDATE working.sales
    SET billing_status = 'unbilled', billed_in_bill_id = NULL
    WHERE billed_in_bill_id = p_replace_bill_id;
    DELETE FROM working.bills WHERE id = p_replace_bill_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM working.bills
    WHERE customer_id = p_customer_id AND bill_date = p_bill_date
  ) THEN
    RAISE EXCEPTION 'A bill already exists for this customer and date';
  END IF;

  SELECT * INTO previous_bill
  FROM working.bills
  WHERE customer_id = p_customer_id
  ORDER BY bill_date DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    previous_balance_value := previous_bill.total;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(item -> 'sale_ids') <> 'array'
       OR jsonb_array_length(item -> 'sale_ids') = 0 THEN
      RAISE EXCEPTION 'Every bill item must contain source sale IDs';
    END IF;

    FOR sale_id_value IN
      SELECT value::BIGINT FROM jsonb_array_elements_text(item -> 'sale_ids')
    LOOP
      PERFORM 1
      FROM working.sales
      WHERE id = sale_id_value
        AND customer_id = p_customer_id
        AND sale_date = p_bill_date
        AND fish_variety_id = (item ->> 'fish_variety_id')::BIGINT
        AND billed_in_bill_id IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale % is unavailable or does not match the bill', sale_id_value;
      END IF;
    END LOOP;

    SELECT COALESCE(SUM(quantity_crates), 0), COALESCE(SUM(quantity_kg), 0)
    INTO source_crates, source_kg
    FROM working.sales
    WHERE id IN (
      SELECT value::BIGINT FROM jsonb_array_elements_text(item -> 'sale_ids')
    );

    IF source_crates <> (item ->> 'quantity_crates')::NUMERIC
       OR source_kg <> (item ->> 'quantity_kg')::NUMERIC THEN
      RAISE EXCEPTION 'Bill item quantities do not match source sales';
    END IF;

    item_amount := ROUND(
      COALESCE(
        NULLIF((item ->> 'quantity_kg')::NUMERIC, 0),
        (item ->> 'quantity_crates')::NUMERIC * (item ->> 'crate_weight')::NUMERIC
      ) * (item ->> 'rate_per_kg')::NUMERIC
    );
    IF item_amount < 0 THEN
      RAISE EXCEPTION 'Bill item amount cannot be negative';
    END IF;
    items_total := items_total + item_amount;
  END LOOP;

  FOR charge IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_other_charges, '[]'::JSONB))
  LOOP
    IF (charge ->> 'amount')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Other charges cannot be negative';
    END IF;
    charges_total := charges_total + (charge ->> 'amount')::NUMERIC;
  END LOOP;

  FOR payment IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_payments, '[]'::JSONB))
  LOOP
    INSERT INTO working.payments (
      customer_id, payment_date, amount, payment_method, reference_number, notes
    ) VALUES (
      p_customer_id,
      p_bill_date,
      (payment ->> 'amount')::NUMERIC,
      COALESCE(payment ->> 'payment_method', 'cash'),
      NULLIF(payment ->> 'reference_number', ''),
      NULLIF(payment ->> 'notes', '')
    );
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO payments_total
  FROM working.payments
  WHERE customer_id = p_customer_id
    AND payment_date > COALESCE(previous_bill.bill_date, DATE '1900-01-01')
    AND payment_date <= p_bill_date;

  balance_before_charges := previous_balance_value - payments_total;
  final_total := balance_before_charges + items_total + charges_total - COALESCE(p_discount, 0);

  IF p_mark_as_paid AND final_total > 0 THEN
    INSERT INTO working.payments (
      customer_id, payment_date, amount, payment_method, notes
    ) VALUES (
      p_customer_id, p_bill_date, final_total, 'cash', 'Full payment for this bill'
    );
    payments_total := payments_total + final_total;
    balance_before_charges := previous_balance_value - payments_total;
    final_total := balance_before_charges + items_total + charges_total - COALESCE(p_discount, 0);
  END IF;

  IF previous_bill.id IS NOT NULL THEN
    UPDATE working.bills SET is_active = FALSE WHERE id = previous_bill.id;
  END IF;

  bill_number_value := COALESCE(
    replaced_bill.bill_number,
    'IB-' || LPAD(nextval('working.customer_bill_number_seq')::TEXT, 4, '0')
  );

  INSERT INTO working.bills (
    bill_number, customer_id, bill_date, subtotal, discount, total,
    previous_balance, amount_paid, balance_due, status, is_active, notes
  ) VALUES (
    bill_number_value, p_customer_id, p_bill_date, items_total + charges_total,
    COALESCE(p_discount, 0), final_total, previous_balance_value, payments_total,
    balance_before_charges, CASE WHEN final_total <= 0 THEN 'paid' ELSE 'unpaid' END,
    TRUE, p_notes
  ) RETURNING * INTO created_bill;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    item_amount := ROUND(
      COALESCE(
        NULLIF((item ->> 'quantity_kg')::NUMERIC, 0),
        (item ->> 'quantity_crates')::NUMERIC * (item ->> 'crate_weight')::NUMERIC
      ) * (item ->> 'rate_per_kg')::NUMERIC
    );

    INSERT INTO working.bill_items (
      bill_id, fish_variety_id, fish_variety_name, quantity_crates, quantity_kg,
      crate_weight, rate_per_crate, rate_per_kg, amount
    ) VALUES (
      created_bill.id,
      (item ->> 'fish_variety_id')::BIGINT,
      item ->> 'fish_variety_name',
      (item ->> 'quantity_crates')::INTEGER,
      (item ->> 'quantity_kg')::NUMERIC,
      (item ->> 'crate_weight')::NUMERIC,
      COALESCE((item ->> 'rate_per_crate')::NUMERIC, 0),
      (item ->> 'rate_per_kg')::NUMERIC,
      item_amount
    ) RETURNING id INTO created_item_id;

    FOR sale_id_value IN
      SELECT value::BIGINT FROM jsonb_array_elements_text(item -> 'sale_ids')
    LOOP
      INSERT INTO working.bill_item_sales (bill_item_id, sale_id)
      VALUES (created_item_id, sale_id_value);

      UPDATE working.sales
      SET billing_status = 'billed', billed_in_bill_id = created_bill.id
      WHERE id = sale_id_value;
    END LOOP;
  END LOOP;

  FOR charge IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_other_charges, '[]'::JSONB))
  LOOP
    INSERT INTO working.bill_other_charges (bill_id, charge_type, description, amount)
    VALUES (
      created_bill.id,
      charge ->> 'charge_type',
      NULLIF(charge ->> 'description', ''),
      (charge ->> 'amount')::NUMERIC
    );
  END LOOP;

  RETURN created_bill;
END;
$$;

CREATE OR REPLACE FUNCTION working.delete_customer_bill(p_bill_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = working
AS $$
DECLARE
  deleted_bill working.bills%ROWTYPE;
  previous_bill_id BIGINT;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete customer bills';
  END IF;

  SELECT * INTO deleted_bill
  FROM working.bills
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF deleted_bill.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the current bill can be deleted because later bills depend on it';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('working-customer-bill:' || deleted_bill.customer_id::TEXT, 0)
  );

  UPDATE working.sales
  SET billing_status = 'unbilled', billed_in_bill_id = NULL
  WHERE billed_in_bill_id = p_bill_id;

  DELETE FROM working.bills WHERE id = p_bill_id;

  SELECT id INTO previous_bill_id
  FROM working.bills
  WHERE customer_id = deleted_bill.customer_id
  ORDER BY bill_date DESC, id DESC
  LIMIT 1;

  IF previous_bill_id IS NOT NULL THEN
    UPDATE working.bills SET is_active = TRUE WHERE id = previous_bill_id;
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION working.create_customer_bill(
  BIGINT, DATE, JSONB, JSONB, NUMERIC, TEXT, JSONB, BOOLEAN, BIGINT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION working.delete_customer_bill(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.create_customer_bill(
  BIGINT, DATE, JSONB, JSONB, NUMERIC, TEXT, JSONB, BOOLEAN, BIGINT
) TO authenticated;
GRANT EXECUTE ON FUNCTION working.delete_customer_bill(BIGINT) TO authenticated;
