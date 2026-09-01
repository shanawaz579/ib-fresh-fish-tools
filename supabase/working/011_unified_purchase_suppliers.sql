-- Unify mediator and direct-farmer payees as supplier accounts.
-- Payments continue to reference purchase bills; bills reference the primary supplier.

DO $$
BEGIN
  IF to_regclass('working.suppliers') IS NULL
     AND to_regclass('working.mediators') IS NOT NULL THEN
    ALTER TABLE working.mediators RENAME TO suppliers;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'working' AND table_name = 'purchases' AND column_name = 'mediator_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'working' AND table_name = 'purchases' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE working.purchases RENAME COLUMN mediator_id TO supplier_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'working' AND table_name = 'purchase_bills' AND column_name = 'mediator_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'working' AND table_name = 'purchase_bills' AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE working.purchase_bills RENAME COLUMN mediator_id TO supplier_id;
  END IF;
END;
$$;

ALTER TABLE working.suppliers
  ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(20) NOT NULL DEFAULT 'mediator';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'working.suppliers'::regclass
      AND conname = 'suppliers_type_check'
  ) THEN
    ALTER TABLE working.suppliers
      ADD CONSTRAINT suppliers_type_check
      CHECK (supplier_type IN ('mediator', 'farmer'));
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'working.purchases'::regclass
      AND conname = 'purchases_mediator_id_fkey'
  ) THEN
    ALTER TABLE working.purchases
      RENAME CONSTRAINT purchases_mediator_id_fkey TO purchases_supplier_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'working.purchase_bills'::regclass
      AND conname = 'purchase_bills_mediator_id_fkey'
  ) THEN
    ALTER TABLE working.purchase_bills
      RENAME CONSTRAINT purchase_bills_mediator_id_fkey TO purchase_bills_supplier_id_fkey;
  END IF;
END;
$$;

DROP INDEX IF EXISTS working.mediators_normalized_name_key;
DROP INDEX IF EXISTS working.idx_purchases_date_mediator;
DROP INDEX IF EXISTS working.idx_purchase_bills_mediator_date;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_normalized_identity_key
  ON working.suppliers (
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')),
    supplier_type,
    lower(regexp_replace(btrim(location), '[[:space:]]+', ' ', 'g'))
  );
CREATE INDEX IF NOT EXISTS idx_suppliers_type_active_name
  ON working.suppliers(supplier_type, is_active, name);
CREATE INDEX IF NOT EXISTS idx_purchases_date_supplier
  ON working.purchases(purchase_date DESC, supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_supplier_date
  ON working.purchase_bills(supplier_id, bill_date DESC, id DESC);

COMMENT ON TABLE working.suppliers IS
  'Primary purchase payees. A supplier account can represent a mediator or a directly paid farmer.';
COMMENT ON COLUMN working.suppliers.supplier_type IS
  'Determines whether a source farmer name is additionally required on purchase entry.';
COMMENT ON COLUMN working.purchases.supplier_id IS
  'Primary supplier/payee whose account receives the purchase bill.';
COMMENT ON COLUMN working.purchase_bills.supplier_id IS
  'Supplier account paid through this bill; payments reference the bill itself.';

CREATE OR REPLACE FUNCTION working.protect_used_supplier_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = working
AS $$
BEGIN
  IF NEW.supplier_type IS DISTINCT FROM OLD.supplier_type
     AND EXISTS (SELECT 1 FROM working.purchases WHERE supplier_id = OLD.id) THEN
    RAISE EXCEPTION 'Supplier type cannot be changed after the account is used in a purchase';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_used_supplier_type ON working.suppliers;
CREATE TRIGGER protect_used_supplier_type
BEFORE UPDATE OF supplier_type ON working.suppliers
FOR EACH ROW EXECUTE FUNCTION working.protect_used_supplier_type();

DROP FUNCTION IF EXISTS working.create_purchase_batch(BIGINT, TEXT, DATE, TEXT, JSONB);

CREATE FUNCTION working.create_purchase_batch(
  p_supplier_id BIGINT,
  p_farmer_name TEXT,
  p_purchase_date DATE,
  p_location TEXT,
  p_items JSONB
)
RETURNS SETOF working.purchases
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = working
AS $$
DECLARE
  item JSONB;
  item_count INTEGER;
  distinct_item_count INTEGER;
  normalized_farmer_name TEXT := regexp_replace(btrim(coalesce(p_farmer_name, '')), '[[:space:]]+', ' ', 'g');
  resolved_farmer_id BIGINT;
  supplier_name TEXT;
  supplier_kind TEXT;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can create purchases';
  END IF;

  SELECT name, supplier_type
  INTO supplier_name, supplier_kind
  FROM working.suppliers
  WHERE id = p_supplier_id AND is_active;

  IF supplier_name IS NULL THEN
    RAISE EXCEPTION 'Select an active primary supplier';
  END IF;

  IF supplier_kind = 'farmer' THEN
    normalized_farmer_name := regexp_replace(btrim(supplier_name), '[[:space:]]+', ' ', 'g');
  ELSIF normalized_farmer_name = '' THEN
    RAISE EXCEPTION 'Source farmer name is required for a mediator purchase';
  END IF;

  SELECT id INTO resolved_farmer_id
  FROM working.farmers
  WHERE lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    = lower(normalized_farmer_name)
  LIMIT 1;

  IF resolved_farmer_id IS NULL THEN
    INSERT INTO working.farmers (name, location)
    VALUES (normalized_farmer_name, nullif(btrim(p_location), ''))
    ON CONFLICT DO NOTHING
    RETURNING id INTO resolved_farmer_id;

    IF resolved_farmer_id IS NULL THEN
      SELECT id INTO resolved_farmer_id
      FROM working.farmers
      WHERE lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
        = lower(normalized_farmer_name)
      LIMIT 1;
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one purchase item is required';
  END IF;

  SELECT count(*), count(DISTINCT (value ->> 'fish_variety_id'))
  INTO item_count, distinct_item_count
  FROM jsonb_array_elements(p_items);

  IF item_count <> distinct_item_count THEN
    RAISE EXCEPTION 'Each item and grade can appear only once in a purchase batch';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF coalesce((item ->> 'quantity_crates')::INTEGER, 0) < 0
       OR coalesce((item ->> 'quantity_kg')::NUMERIC, 0) <= 0 THEN
      RAISE EXCEPTION 'Crates cannot be negative and actual kilograms must be greater than zero';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM working.item_variants variant
      JOIN working.items catalog_item ON catalog_item.id = variant.item_id
      WHERE variant.id = (item ->> 'fish_variety_id')::BIGINT
        AND variant.is_active
        AND catalog_item.is_active
    ) THEN
      RAISE EXCEPTION 'A selected item or grade is inactive';
    END IF;
  END LOOP;

  RETURN QUERY
  INSERT INTO working.purchases (
    supplier_id, farmer_id, fish_variety_id, quantity_crates, quantity_kg,
    purchase_date, location, secondary_name
  )
  SELECT
    p_supplier_id,
    resolved_farmer_id,
    (value ->> 'fish_variety_id')::BIGINT,
    coalesce((value ->> 'quantity_crates')::INTEGER, 0),
    (value ->> 'quantity_kg')::NUMERIC,
    p_purchase_date,
    nullif(btrim(p_location), ''),
    normalized_farmer_name
  FROM jsonb_array_elements(p_items)
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION working.protect_billed_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = working
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.billing_status = 'billed' THEN
    RAISE EXCEPTION 'Billed purchases cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.billing_status = 'billed'
     AND (
       NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
       OR NEW.farmer_id IS DISTINCT FROM OLD.farmer_id
       OR NEW.fish_variety_id IS DISTINCT FROM OLD.fish_variety_id
       OR NEW.quantity_crates IS DISTINCT FROM OLD.quantity_crates
       OR NEW.quantity_kg IS DISTINCT FROM OLD.quantity_kg
       OR NEW.purchase_date IS DISTINCT FROM OLD.purchase_date
       OR NEW.location IS DISTINCT FROM OLD.location
     ) THEN
    RAISE EXCEPTION 'Billed purchase details cannot be changed';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS working.create_purchase_bill(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
);

CREATE FUNCTION working.create_purchase_bill(
  p_supplier_id BIGINT,
  p_bill_date DATE,
  p_items JSONB,
  p_commission_amount NUMERIC DEFAULT 0,
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
  weight_deduction_value NUMERIC(14,2);
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

  SELECT supplier_type INTO supplier_kind
  FROM working.suppliers
  WHERE id = p_supplier_id AND is_active;

  IF supplier_kind IS NULL THEN
    RAISE EXCEPTION 'Select an active primary supplier';
  END IF;
  IF supplier_kind = 'farmer' AND coalesce(p_commission_amount, 0) <> 0 THEN
    RAISE EXCEPTION 'Commission cannot be added to a direct-farmer bill';
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

    gross_amount_value := gross_amount_value
      + (item ->> 'actual_weight')::NUMERIC * (item ->> 'rate_per_kg')::NUMERIC;
    subtotal_value := subtotal_value + (item ->> 'amount')::NUMERIC;
  END LOOP;

  weight_deduction_value := gross_amount_value - subtotal_value;
  deductions_total := coalesce(p_advance_amount, 0) + coalesce(p_other_charges_deduction, 0);
  total_value := subtotal_value + coalesce(p_commission_amount, 0)
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
    weight_deduction_value, subtotal_value, 0, coalesce(p_commission_amount, 0),
    deductions, deductions_total, total_value, 'pending', 0, total_value,
    p_notes, nullif(btrim(p_location), ''), NULL
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

REVOKE ALL ON FUNCTION working.create_purchase_batch(BIGINT, TEXT, DATE, TEXT, JSONB)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION working.create_purchase_bill(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.create_purchase_batch(BIGINT, TEXT, DATE, TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION working.create_purchase_bill(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
) TO authenticated;
