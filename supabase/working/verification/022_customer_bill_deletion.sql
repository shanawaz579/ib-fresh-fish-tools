BEGIN;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"bill-delete-verification@example.com","app_metadata":{"role":"admin"}}',
  true
);

DO $$
DECLARE
  customer_value BIGINT;
  variant_value BIGINT;
  location_value BIGINT;
  sale_value BIGINT;
  bill_value BIGINT;
  item_value BIGINT;
  payment_value working.payments%ROWTYPE;
  blocked BOOLEAN := FALSE;
BEGIN
  SELECT id INTO variant_value FROM working.item_variants WHERE is_active ORDER BY id LIMIT 1;
  IF variant_value IS NULL THEN RAISE EXCEPTION 'Verification requires one active item variant'; END IF;
  SELECT id INTO location_value FROM working.stock_locations WHERE code = 'MAIN';
  INSERT INTO working.stock_movements(
    movement_date, location_id, item_variant_id, movement_type,
    crates_delta, kg_delta, source_type, reason
  ) VALUES (
    CURRENT_DATE, location_value, variant_value, 'opening',
    2, 100, 'manual', 'Bill deletion verification stock'
  );

  INSERT INTO working.customers(name) VALUES ('Bill deletion verification') RETURNING id INTO customer_value;
  INSERT INTO working.sales(customer_id, fish_variety_id, quantity_crates, quantity_kg, sale_date, billing_status)
  VALUES (customer_value, variant_value, 1, 5, CURRENT_DATE, 'unbilled') RETURNING id INTO sale_value;
  INSERT INTO working.bills(bill_number, customer_id, bill_date, subtotal, total, balance_due, status, is_active)
  VALUES ('VERIFY-DELETE-' || customer_value, customer_value, CURRENT_DATE, 500, 500, 500, 'unpaid', TRUE)
  RETURNING id INTO bill_value;
  INSERT INTO working.bill_items(bill_id, fish_variety_id, fish_variety_name, quantity_crates, quantity_kg, crate_weight, rate_per_kg, amount)
  VALUES (bill_value, variant_value, 'Verification item', 1, 5, 35, 12.5, 500) RETURNING id INTO item_value;
  INSERT INTO working.bill_item_sales(bill_item_id, sale_id) VALUES (item_value, sale_value);
  INSERT INTO working.bill_other_charges(bill_id, charge_type, amount) VALUES (bill_value, 'ice', 10);
  UPDATE working.sales SET billing_status = 'billed', billed_in_bill_id = bill_value WHERE id = sale_value;

  SELECT * INTO payment_value FROM working.record_customer_payment(customer_value, CURRENT_DATE, 100, 'cash', NULL, 'Deletion guard verification');

  BEGIN
    PERFORM working.delete_customer_bill(bill_value);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Void active receipts linked%' THEN blocked := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Bill deletion was not blocked by an active receipt'; END IF;

  PERFORM working.void_customer_payment(payment_value.id, 'Verification cleanup');
  IF working.delete_customer_bill(bill_value) IS NOT TRUE THEN RAISE EXCEPTION 'Bill was not deleted'; END IF;

  IF EXISTS (SELECT 1 FROM working.bills WHERE id = bill_value) THEN RAISE EXCEPTION 'Bill orphan remains'; END IF;
  IF EXISTS (SELECT 1 FROM working.bill_items WHERE bill_id = bill_value) THEN RAISE EXCEPTION 'Bill item orphan remains'; END IF;
  IF EXISTS (SELECT 1 FROM working.bill_other_charges WHERE bill_id = bill_value) THEN RAISE EXCEPTION 'Charge orphan remains'; END IF;
  IF EXISTS (SELECT 1 FROM working.bill_item_sales WHERE bill_item_id = item_value) THEN RAISE EXCEPTION 'Sale-link orphan remains'; END IF;
  IF NOT EXISTS (SELECT 1 FROM working.sales WHERE id = sale_value AND billing_status = 'unbilled' AND billed_in_bill_id IS NULL) THEN
    RAISE EXCEPTION 'Source sale was not released for rebilling';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM working.payments WHERE id = payment_value.id AND voided_at IS NOT NULL AND bill_id IS NULL) THEN
    RAISE EXCEPTION 'Voided receipt audit was not safely retained';
  END IF;
END;
$$;

ROLLBACK;
