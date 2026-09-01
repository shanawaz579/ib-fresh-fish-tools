BEGIN;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"sales-verification@example.com","app_metadata":{"role":"admin"}}',
  true
);

DO $$
DECLARE
  test_customer_id BIGINT;
  test_variant_id BIGINT;
  kg_variant_id BIGINT;
  saved_sale_id BIGINT;
BEGIN
  SELECT id INTO test_customer_id FROM working.customers WHERE is_active ORDER BY id LIMIT 1;
  IF test_customer_id IS NULL THEN
    INSERT INTO working.customers (name)
    VALUES ('Rollback-only sales verification')
    RETURNING id INTO test_customer_id;
  END IF;
  SELECT item_variant_id INTO test_variant_id
  FROM working.stock_movements
  WHERE voided_at IS NULL
  GROUP BY item_variant_id
  HAVING sum(crates_delta) >= 1
  ORDER BY item_variant_id
  LIMIT 1;

  IF test_variant_id IS NULL THEN
    RAISE EXCEPTION 'Verification requires one crate in stock';
  END IF;

  SELECT id INTO saved_sale_id
  FROM working.save_sales_batch(
    test_customer_id,
    current_date,
    jsonb_build_array(jsonb_build_object(
      'fish_variety_id', test_variant_id,
      'quantity_crates', 1,
      'quantity_kg', 0
    ))
  );

  IF NOT EXISTS (
    SELECT 1 FROM working.sales
    WHERE id = saved_sale_id AND quantity_crates = 1 AND quantity_kg = 0
  ) THEN
    RAISE EXCEPTION 'Crate-only sale was not saved correctly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM working.stock_movements
    WHERE source_type = 'sale'
      AND source_id = saved_sale_id
      AND crates_delta = -1
      AND kg_delta = 0
      AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Crate-only sale did not create the correct stock movement';
  END IF;

  SELECT item_variant_id INTO kg_variant_id
  FROM working.stock_movements
  WHERE voided_at IS NULL
  GROUP BY item_variant_id
  HAVING sum(kg_delta) >= 0.01
  ORDER BY item_variant_id
  LIMIT 1;

  SELECT id INTO saved_sale_id
  FROM working.save_sales_batch(
    test_customer_id,
    current_date,
    jsonb_build_array(jsonb_build_object(
      'fish_variety_id', kg_variant_id,
      'quantity_crates', 0,
      'quantity_kg', 0.01
    ))
  );

  IF NOT EXISTS (
    SELECT 1 FROM working.sales
    WHERE id = saved_sale_id AND quantity_crates = 0 AND quantity_kg = 0.01
  ) THEN
    RAISE EXCEPTION 'Kilogram-only sale was not saved correctly';
  END IF;
END;
$$;

ROLLBACK;

SELECT
  TRUE AS crates_and_kg_only_sales_verified,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'working.sales'::regclass
      AND conname = 'sales_quantity_present'
  ) AS has_quantity_present_guard;
