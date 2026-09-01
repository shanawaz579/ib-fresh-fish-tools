-- Purchases may contain crates, loose kilograms, or both.
-- quantity_kg represents loose kilograms in addition to crate-estimated weight.

ALTER TABLE working.purchases
  DROP CONSTRAINT IF EXISTS purchases_quantity_kg_check,
  DROP CONSTRAINT IF EXISTS purchases_actual_weight_positive,
  DROP CONSTRAINT IF EXISTS purchases_quantity_kg_nonnegative,
  DROP CONSTRAINT IF EXISTS purchases_quantity_present;

ALTER TABLE working.purchases
  ADD CONSTRAINT purchases_quantity_kg_nonnegative CHECK (quantity_kg >= 0),
  ADD CONSTRAINT purchases_quantity_present CHECK (quantity_crates > 0 OR quantity_kg > 0);

COMMENT ON COLUMN working.purchases.quantity_crates IS
  'Number of full crates. May be zero when the purchase contains loose kilograms only.';
COMMENT ON COLUMN working.purchases.quantity_kg IS
  'Loose kilograms in addition to full crates. May be zero when the purchase contains crates only.';

CREATE INDEX IF NOT EXISTS idx_purchases_recent_variety
  ON working.purchases(created_at DESC, fish_variety_id);

CREATE OR REPLACE FUNCTION working.create_purchase_batch(
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
  item_crates INTEGER;
  item_loose_kg NUMERIC;
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
    item_crates := coalesce((item ->> 'quantity_crates')::INTEGER, 0);
    item_loose_kg := coalesce((item ->> 'quantity_kg')::NUMERIC, 0);

    IF item_crates < 0 OR item_loose_kg < 0 OR (item_crates = 0 AND item_loose_kg = 0) THEN
      RAISE EXCEPTION 'Enter crates, loose kilograms, or both; values cannot be negative';
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
    coalesce((value ->> 'quantity_kg')::NUMERIC, 0),
    p_purchase_date,
    nullif(btrim(p_location), ''),
    normalized_farmer_name
  FROM jsonb_array_elements(p_items)
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION working.create_purchase_batch(BIGINT, TEXT, DATE, TEXT, JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.create_purchase_batch(BIGINT, TEXT, DATE, TEXT, JSONB)
  TO authenticated;
