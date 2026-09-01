BEGIN;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"purchase-delete-verification@example.com","app_metadata":{"role":"admin"}}',
  true
);

DO $$
DECLARE
  supplier_value BIGINT;
  farmer_value BIGINT;
  variant_value BIGINT;
  purchase_value BIGINT;
  bill_value BIGINT;
  payment_value working.purchase_bill_payments%ROWTYPE;
  blocked BOOLEAN := FALSE;
BEGIN
  SELECT id INTO variant_value FROM working.item_variants WHERE is_active ORDER BY id LIMIT 1;
  IF variant_value IS NULL THEN RAISE EXCEPTION 'Verification requires one active item variant'; END IF;

  INSERT INTO working.suppliers(name, supplier_type, location)
  VALUES ('Purchase deletion verification', 'farmer', 'Verification')
  RETURNING id INTO supplier_value;
  INSERT INTO working.farmers(name) VALUES ('Purchase deletion source farmer')
  RETURNING id INTO farmer_value;

  INSERT INTO working.purchases(
    supplier_id, farmer_id, fish_variety_id, quantity_crates, quantity_kg,
    purchase_date, billing_status
  ) VALUES (
    supplier_value, farmer_value, variant_value, 1, 10, CURRENT_DATE, 'unbilled'
  ) RETURNING id INTO purchase_value;

  INSERT INTO working.purchase_bills(
    bill_number, supplier_id, bill_date, subtotal, total,
    payment_status, amount_paid, balance_due
  ) VALUES (
    'VERIFY-PB-DELETE-' || supplier_value, supplier_value, CURRENT_DATE,
    500, 500, 'pending', 0, 500
  ) RETURNING id INTO bill_value;

  INSERT INTO working.purchase_bill_items(
    purchase_bill_id, purchase_id, fish_variety_id, fish_variety_name,
    quantity_crates, quantity_kg, actual_weight, billable_weight,
    rate_per_kg, amount
  ) VALUES (
    bill_value, purchase_value, variant_value, 'Verification item',
    1, 10, 45, 40, 12.5, 500
  );
  UPDATE working.purchases SET billing_status = 'billed', billed_in_bill_id = bill_value WHERE id = purchase_value;

  PERFORM working.record_purchase_bill_payment(bill_value, CURRENT_DATE, 100, 'cash', NULL, 'Deletion guard verification');
  SELECT * INTO payment_value FROM working.purchase_bill_payments WHERE purchase_bill_id = bill_value;

  BEGIN
    PERFORM working.delete_purchase_bill(bill_value);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'Void active supplier payments linked%' THEN blocked := TRUE; ELSE RAISE; END IF;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'Purchase bill deletion was not blocked by active payment'; END IF;

  PERFORM working.void_purchase_bill_payment(payment_value.id, 'Verification cleanup');
  IF working.delete_purchase_bill(bill_value) IS NOT TRUE THEN RAISE EXCEPTION 'Purchase bill was not deleted'; END IF;

  IF EXISTS (SELECT 1 FROM working.purchase_bills WHERE id = bill_value) THEN RAISE EXCEPTION 'Purchase bill orphan remains'; END IF;
  IF EXISTS (SELECT 1 FROM working.purchase_bill_items WHERE purchase_bill_id = bill_value) THEN RAISE EXCEPTION 'Purchase bill item orphan remains'; END IF;
  IF NOT EXISTS (SELECT 1 FROM working.purchases WHERE id = purchase_value AND billing_status = 'unbilled' AND billed_in_bill_id IS NULL) THEN
    RAISE EXCEPTION 'Source purchase was not released for rebilling';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM working.purchase_bill_payments
    WHERE id = payment_value.id
      AND voided_at IS NOT NULL
      AND purchase_bill_id IS NULL
      AND supplier_id = supplier_value
      AND bill_number_snapshot = 'VERIFY-PB-DELETE-' || supplier_value
  ) THEN
    RAISE EXCEPTION 'Voided supplier payment audit was not safely retained';
  END IF;
END;
$$;

ROLLBACK;
