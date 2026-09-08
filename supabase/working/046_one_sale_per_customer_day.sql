BEGIN;

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

  PERFORM pg_advisory_xact_lock(hashtextextended('working-sale-day:' || p_customer_id::TEXT || ':' || p_sale_date::TEXT, 0));
  IF EXISTS (SELECT 1 FROM working.sales WHERE customer_id = p_customer_id AND sale_date = p_sale_date) THEN
    RAISE EXCEPTION 'A sale already exists for this customer on this date. Edit the existing sale instead.';
  END IF;

  SELECT count(*), count(DISTINCT (value ->> 'fish_variety_id'))
  INTO item_count, distinct_item_count FROM jsonb_array_elements(p_items);
  IF item_count <> distinct_item_count THEN RAISE EXCEPTION 'Each item and grade can appear only once'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    crates_value := coalesce((item ->> 'quantity_crates')::INTEGER, 0);
    kg_value := coalesce((item ->> 'quantity_kg')::NUMERIC, 0);
    IF crates_value < 0 OR kg_value < 0 OR (crates_value = 0 AND kg_value = 0) THEN
      RAISE EXCEPTION 'Enter crates, kilograms, or both; values cannot be negative';
    END IF;
    INSERT INTO working.sales (customer_id, fish_variety_id, quantity_crates, quantity_kg, sale_date)
    VALUES (p_customer_id, (item ->> 'fish_variety_id')::BIGINT, crates_value, kg_value, p_sale_date)
    RETURNING * INTO saved_sale;
    RETURN NEXT saved_sale;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION working.save_sales_batch(BIGINT, DATE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.save_sales_batch(BIGINT, DATE, JSONB) TO authenticated;
COMMENT ON FUNCTION working.save_sales_batch(BIGINT, DATE, JSONB) IS
  'Creates one logical sales batch per customer and date; later changes must use the edit workflow.';

COMMIT;
