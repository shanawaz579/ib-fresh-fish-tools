-- Accept farmer names as free text while retaining normalized farmer records.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM working.mediators
    GROUP BY lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate mediator names before installing mediator search protection';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS mediators_normalized_name_key
  ON working.mediators (lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')));

DROP FUNCTION IF EXISTS working.create_purchase_batch(BIGINT, BIGINT, DATE, TEXT, JSONB);

CREATE FUNCTION working.create_purchase_batch(
  p_mediator_id BIGINT,
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
  normalized_farmer_name TEXT := regexp_replace(btrim(p_farmer_name), '[[:space:]]+', ' ', 'g');
  resolved_farmer_id BIGINT;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can create purchases';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM working.mediators WHERE id = p_mediator_id AND is_active) THEN
    RAISE EXCEPTION 'Select an active mediator';
  END IF;

  IF normalized_farmer_name = '' THEN
    RAISE EXCEPTION 'Farmer name is required';
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
    mediator_id, farmer_id, fish_variety_id, quantity_crates, quantity_kg,
    purchase_date, location, secondary_name
  )
  SELECT
    p_mediator_id,
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

REVOKE ALL ON FUNCTION working.create_purchase_batch(BIGINT, TEXT, DATE, TEXT, JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.create_purchase_batch(BIGINT, TEXT, DATE, TEXT, JSONB)
  TO authenticated;
