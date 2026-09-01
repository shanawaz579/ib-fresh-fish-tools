BEGIN;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"stock-verification@example.com","app_metadata":{"role":"admin"}}',
  true
);

DO $$
DECLARE
  test_variant_id BIGINT;
  test_customer_id BIGINT;
  adjustment_id BIGINT;
  movement_count_before BIGINT;
  negative_blocked BOOLEAN := FALSE;
BEGIN
  SELECT item_variant_id INTO test_variant_id
  FROM working.stock_movements
  WHERE voided_at IS NULL
  GROUP BY item_variant_id
  HAVING sum(kg_delta) >= 1
  ORDER BY item_variant_id
  LIMIT 1;

  IF test_variant_id IS NULL THEN
    RAISE EXCEPTION 'Verification needs one item with at least 1 kg of stock';
  END IF;

  SELECT count(*) INTO movement_count_before FROM working.stock_movements;

  SELECT id INTO adjustment_id
  FROM working.record_stock_adjustment(
    test_variant_id,
    current_date,
    'adjustment_in',
    1,
    1,
    'Automated rollback verification',
    NULL
  );

  IF (SELECT count(*) FROM working.stock_movements) <> movement_count_before + 1 THEN
    RAISE EXCEPTION 'Adjustment RPC did not append one movement';
  END IF;

  PERFORM working.void_stock_adjustment(adjustment_id, 'Automated rollback verification');
  IF NOT EXISTS (
    SELECT 1 FROM working.stock_movements WHERE id = adjustment_id AND voided_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Void RPC did not retain and void the movement';
  END IF;

  BEGIN
    PERFORM working.record_stock_adjustment(
      test_variant_id,
      current_date,
      'adjustment_out',
      0,
      999999999,
      'Must be rejected',
      NULL
    );
  EXCEPTION WHEN OTHERS THEN
    negative_blocked := position('Insufficient' IN SQLERRM) > 0;
  END;

  IF NOT negative_blocked THEN
    RAISE EXCEPTION 'Negative-stock protection did not reject an excessive outward adjustment';
  END IF;

  SELECT id INTO test_customer_id
  FROM working.customers
  WHERE is_active
  ORDER BY id
  LIMIT 1;

  IF test_customer_id IS NOT NULL THEN
    PERFORM working.save_sales_batch(
      test_customer_id,
      current_date,
      jsonb_build_array(jsonb_build_object(
        'fish_variety_id', test_variant_id,
        'quantity_crates', 0,
        'quantity_kg', 0.01
      ))
    );

    IF NOT EXISTS (
      SELECT 1
      FROM working.stock_movements movement
      JOIN working.sales sale ON sale.id = movement.source_id
      WHERE movement.source_type = 'sale'
        AND movement.voided_at IS NULL
        AND sale.customer_id = test_customer_id
        AND sale.fish_variety_id = test_variant_id
        AND sale.sale_date = current_date
    ) THEN
      RAISE EXCEPTION 'Atomic sales batch did not create its stock movement';
    END IF;
  END IF;
END;
$$;

ROLLBACK;

SELECT TRUE AS stock_ledger_behavior_verified;
