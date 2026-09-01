-- Allow optional billable-weight commission for direct-farmer bills as well as mediator bills.

DROP FUNCTION IF EXISTS working.create_purchase_bill(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
);

CREATE FUNCTION working.create_purchase_bill(
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
SECURITY INVOKER
SET search_path = working
AS $$
DECLARE
  item JSONB;
  created_bill working.purchase_bills%ROWTYPE;
  purchase_id_value BIGINT;
  gross_amount_value NUMERIC(14,2) := 0;
  subtotal_value NUMERIC(14,2) := 0;
  total_billable_weight NUMERIC(14,2) := 0;
  weight_deduction_value NUMERIC(14,2);
  commission_amount_value NUMERIC(14,2);
  deductions JSONB := '[]'::JSONB;
  deductions_total NUMERIC(14,2);
  total_value NUMERIC(14,2);
  bill_number_value TEXT;
  supplier_kind TEXT;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can create purchase bills';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one purchase bill item is required';
  END IF;
  IF coalesce(p_commission_per_kg, 0) < 0 THEN
    RAISE EXCEPTION 'Commission per kilogram cannot be negative';
  END IF;

  SELECT supplier_type INTO supplier_kind
  FROM working.suppliers
  WHERE id = p_supplier_id AND is_active;

  IF supplier_kind IS NULL THEN
    RAISE EXCEPTION 'Select an active primary supplier';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended('working-purchase-bill:' || p_supplier_id::TEXT, 0)
  );

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    purchase_id_value := (item ->> 'purchase_id')::BIGINT;

    PERFORM 1
    FROM working.purchases
    WHERE id = purchase_id_value
      AND supplier_id = p_supplier_id
      AND fish_variety_id = (item ->> 'fish_variety_id')::BIGINT
      AND quantity_crates = (item ->> 'quantity_crates')::INTEGER
      AND quantity_kg = (item ->> 'quantity_kg')::NUMERIC
      AND billing_status = 'unbilled'
      AND billed_in_bill_id IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase % is unavailable or does not match the bill', purchase_id_value;
    END IF;

    IF coalesce((item ->> 'billable_weight')::NUMERIC, 0) <= 0
       OR coalesce((item ->> 'rate_per_kg')::NUMERIC, 0) <= 0
       OR coalesce((item ->> 'amount')::NUMERIC, 0) < 0 THEN
      RAISE EXCEPTION 'Billable weight and rate must be greater than zero';
    END IF;

    gross_amount_value := gross_amount_value
      + (item ->> 'actual_weight')::NUMERIC * (item ->> 'rate_per_kg')::NUMERIC;
    subtotal_value := subtotal_value + (item ->> 'amount')::NUMERIC;
    total_billable_weight := total_billable_weight + (item ->> 'billable_weight')::NUMERIC;
  END LOOP;

  weight_deduction_value := gross_amount_value - subtotal_value;
  commission_amount_value := round(
    total_billable_weight * coalesce(p_commission_per_kg, 0),
    2
  );
  deductions_total := coalesce(p_advance_amount, 0) + coalesce(p_other_charges_deduction, 0);
  total_value := subtotal_value + commission_amount_value
    + coalesce(p_other_charges_addition, 0) - deductions_total;

  IF total_value < 0 THEN
    RAISE EXCEPTION 'Deductions cannot exceed the payable bill amount';
  END IF;

  IF coalesce(p_advance_amount, 0) > 0 THEN
    deductions := deductions || jsonb_build_array(
      jsonb_build_object('type', 'advance', 'amount', p_advance_amount)
    );
  END IF;
  IF coalesce(p_other_charges_addition, 0) > 0 THEN
    deductions := deductions || jsonb_build_array(
      jsonb_build_object('type', 'other_charges_addition', 'amount', p_other_charges_addition)
    );
  END IF;
  IF coalesce(p_other_charges_deduction, 0) > 0 THEN
    deductions := deductions || jsonb_build_array(
      jsonb_build_object('type', 'other_charges_deduction', 'amount', p_other_charges_deduction)
    );
  END IF;

  bill_number_value := 'PB-'
    || lpad(nextval('working.purchase_bill_number_seq')::TEXT, 4, '0');

  INSERT INTO working.purchase_bills (
    bill_number, supplier_id, bill_date, gross_amount, weight_deduction_percentage,
    weight_deduction_amount, subtotal, commission_per_kg, commission_amount,
    other_deductions, other_deductions_total, total, payment_status,
    amount_paid, balance_due, notes, location, secondary_name
  ) VALUES (
    bill_number_value, p_supplier_id, p_bill_date, gross_amount_value, 5,
    weight_deduction_value, subtotal_value, coalesce(p_commission_per_kg, 0),
    commission_amount_value, deductions, deductions_total, total_value,
    'pending', 0, total_value, p_notes, nullif(btrim(p_location), ''), NULL
  ) RETURNING * INTO created_bill;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    purchase_id_value := (item ->> 'purchase_id')::BIGINT;

    INSERT INTO working.purchase_bill_items (
      purchase_bill_id, purchase_id, fish_variety_id, fish_variety_name,
      quantity_crates, quantity_kg, actual_weight, billable_weight, rate_per_kg, amount
    ) VALUES (
      created_bill.id,
      purchase_id_value,
      (item ->> 'fish_variety_id')::BIGINT,
      item ->> 'fish_variety_name',
      (item ->> 'quantity_crates')::INTEGER,
      (item ->> 'quantity_kg')::NUMERIC,
      (item ->> 'actual_weight')::NUMERIC,
      (item ->> 'billable_weight')::NUMERIC,
      (item ->> 'rate_per_kg')::NUMERIC,
      (item ->> 'amount')::NUMERIC
    );

    UPDATE working.purchases
    SET billing_status = 'billed', billed_in_bill_id = created_bill.id
    WHERE id = purchase_id_value;
  END LOOP;

  RETURN created_bill;
END;
$$;

REVOKE ALL ON FUNCTION working.create_purchase_bill(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.create_purchase_bill(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
) TO authenticated;
