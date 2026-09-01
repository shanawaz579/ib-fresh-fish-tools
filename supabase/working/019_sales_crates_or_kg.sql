-- Sales may contain crates, kilograms, or both, matching purchase and stock units.

ALTER TABLE working.sales
  DROP CONSTRAINT IF EXISTS sales_quantity_kg_check,
  DROP CONSTRAINT IF EXISTS sales_actual_weight_positive,
  DROP CONSTRAINT IF EXISTS sales_quantity_kg_nonnegative,
  DROP CONSTRAINT IF EXISTS sales_quantity_present;

ALTER TABLE working.sales
  ADD CONSTRAINT sales_quantity_kg_nonnegative CHECK (quantity_kg >= 0),
  ADD CONSTRAINT sales_quantity_present CHECK (quantity_crates > 0 OR quantity_kg > 0);

COMMENT ON COLUMN working.sales.quantity_crates IS
  'Number of crates sold. May be zero for kilogram-only sales.';
COMMENT ON COLUMN working.sales.quantity_kg IS
  'Kilograms sold separately from crates. May be zero for crate-only sales.';

CREATE OR REPLACE FUNCTION working.save_sales_batch(
  p_customer_id BIGINT,
  p_sale_date DATE,
  p_items JSONB
)
RETURNS SETOF working.sales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = working
AS $$
DECLARE
  item JSONB;
  item_count INTEGER;
  distinct_item_count INTEGER;
  crates_value INTEGER;
  kg_value NUMERIC;
  saved_sale working.sales%ROWTYPE;
BEGIN
  IF working.current_app_role() <> 'admin' THEN RAISE EXCEPTION 'Only administrators can create sales'; END IF;
  IF NOT EXISTS (SELECT 1 FROM working.customers WHERE id = p_customer_id AND is_active) THEN
    RAISE EXCEPTION 'Select an active customer';
  END IF;
  IF p_sale_date > current_date THEN RAISE EXCEPTION 'Sale date cannot be in the future'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  SELECT count(*), count(DISTINCT (value ->> 'fish_variety_id'))
  INTO item_count, distinct_item_count FROM jsonb_array_elements(p_items);
  IF item_count <> distinct_item_count THEN RAISE EXCEPTION 'Each item and grade can appear only once'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    crates_value := coalesce((item ->> 'quantity_crates')::INTEGER, 0);
    kg_value := coalesce((item ->> 'quantity_kg')::NUMERIC, 0);
    IF crates_value < 0 OR kg_value < 0 OR (crates_value = 0 AND kg_value = 0) THEN
      RAISE EXCEPTION 'Enter crates, kilograms, or both; values cannot be negative';
    END IF;

    saved_sale := NULL;
    INSERT INTO working.sales (customer_id, fish_variety_id, quantity_crates, quantity_kg, sale_date)
    VALUES (p_customer_id, (item ->> 'fish_variety_id')::BIGINT, crates_value, kg_value, p_sale_date)
    ON CONFLICT (customer_id, fish_variety_id, sale_date)
    DO UPDATE SET quantity_crates = EXCLUDED.quantity_crates, quantity_kg = EXCLUDED.quantity_kg
    WHERE sales.billing_status = 'unbilled'
    RETURNING * INTO saved_sale;

    IF saved_sale.id IS NULL THEN RAISE EXCEPTION 'A billed sale cannot be changed'; END IF;
    RETURN NEXT saved_sale;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION working.update_sales_group(
  p_customer_id BIGINT,
  p_sale_date DATE,
  p_items JSONB
)
RETURNS SETOF working.sales
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = working
AS $$
DECLARE
  item JSONB;
  item_count INTEGER;
  distinct_item_count INTEGER;
  crates_value INTEGER;
  kg_value NUMERIC;
  saved_sale working.sales%ROWTYPE;
BEGIN
  IF working.current_app_role() <> 'admin' THEN RAISE EXCEPTION 'Only administrators can edit sales'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A sale group must retain at least one item';
  END IF;

  PERFORM 1 FROM working.sales
  WHERE customer_id = p_customer_id AND sale_date = p_sale_date
  ORDER BY id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM working.sales
    WHERE customer_id = p_customer_id AND sale_date = p_sale_date AND billing_status <> 'unbilled'
  ) THEN RAISE EXCEPTION 'Billed sales cannot be edited'; END IF;

  SELECT count(*), count(DISTINCT (value ->> 'fish_variety_id'))
  INTO item_count, distinct_item_count FROM jsonb_array_elements(p_items);
  IF item_count <> distinct_item_count THEN RAISE EXCEPTION 'Each item and grade can appear only once'; END IF;

  DELETE FROM working.sales sale
  WHERE sale.customer_id = p_customer_id
    AND sale.sale_date = p_sale_date
    AND sale.billing_status = 'unbilled'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_items) submitted
      WHERE (submitted ->> 'fish_variety_id')::BIGINT = sale.fish_variety_id
    );

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    crates_value := coalesce((item ->> 'quantity_crates')::INTEGER, 0);
    kg_value := coalesce((item ->> 'quantity_kg')::NUMERIC, 0);
    IF crates_value < 0 OR kg_value < 0 OR (crates_value = 0 AND kg_value = 0) THEN
      RAISE EXCEPTION 'Enter crates, kilograms, or both; values cannot be negative';
    END IF;

    INSERT INTO working.sales (customer_id, fish_variety_id, quantity_crates, quantity_kg, sale_date)
    VALUES (p_customer_id, (item ->> 'fish_variety_id')::BIGINT, crates_value, kg_value, p_sale_date)
    ON CONFLICT (customer_id, fish_variety_id, sale_date)
    DO UPDATE SET quantity_crates = EXCLUDED.quantity_crates, quantity_kg = EXCLUDED.quantity_kg
    RETURNING * INTO saved_sale;
    RETURN NEXT saved_sale;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION working.save_sales_batch(BIGINT, DATE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.save_sales_batch(BIGINT, DATE, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION working.update_sales_group(BIGINT, DATE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.update_sales_group(BIGINT, DATE, JSONB) TO authenticated;
