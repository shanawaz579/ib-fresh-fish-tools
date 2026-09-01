-- Atomically edit all unbilled lines shown as one prospective purchase bill.

CREATE OR REPLACE FUNCTION working.update_purchase_group(
  p_purchase_ids BIGINT[],
  p_items JSONB
)
RETURNS SETOF working.purchases
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = working
AS $$
DECLARE
  item JSONB;
  requested_count INTEGER;
  locked_count INTEGER;
  group_count INTEGER;
  item_count INTEGER;
  distinct_item_ids INTEGER;
  distinct_variants INTEGER;
  item_crates INTEGER;
  item_kg NUMERIC;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can edit purchases';
  END IF;

  requested_count := cardinality(p_purchase_ids);
  IF requested_count IS NULL OR requested_count = 0 THEN
    RAISE EXCEPTION 'At least one original purchase line is required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A purchase must retain at least one item';
  END IF;
  IF requested_count <> (SELECT count(DISTINCT id) FROM unnest(p_purchase_ids) AS id) THEN
    RAISE EXCEPTION 'Original purchase IDs must be unique';
  END IF;

  PERFORM 1
  FROM working.purchases
  WHERE id = ANY(p_purchase_ids)
  ORDER BY id
  FOR UPDATE;

  SELECT count(*), count(DISTINCT (supplier_id, farmer_id, purchase_date, coalesce(location, '')))
  INTO locked_count, group_count
  FROM working.purchases
  WHERE id = ANY(p_purchase_ids)
    AND billing_status = 'unbilled'
    AND billed_in_bill_id IS NULL;

  IF locked_count <> requested_count THEN
    RAISE EXCEPTION 'One or more purchase lines are missing or already billed';
  END IF;
  IF group_count <> 1 THEN
    RAISE EXCEPTION 'Purchase lines must belong to the same supplier, source, date, and location';
  END IF;

  SELECT count(*), count(DISTINCT (value ->> 'id')), count(DISTINCT (value ->> 'fish_variety_id'))
  INTO item_count, distinct_item_ids, distinct_variants
  FROM jsonb_array_elements(p_items);

  IF item_count <> distinct_item_ids THEN
    RAISE EXCEPTION 'Each purchase line can appear only once';
  END IF;
  IF item_count <> distinct_variants THEN
    RAISE EXCEPTION 'Each item and grade can appear only once';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF NOT ((item ->> 'id')::BIGINT = ANY(p_purchase_ids)) THEN
      RAISE EXCEPTION 'A submitted line does not belong to this purchase';
    END IF;

    item_crates := coalesce((item ->> 'quantity_crates')::INTEGER, 0);
    item_kg := coalesce((item ->> 'quantity_kg')::NUMERIC, 0);
    IF item_crates < 0 OR item_kg < 0 OR (item_crates = 0 AND item_kg = 0) THEN
      RAISE EXCEPTION 'Each line needs crates, kilograms, or both';
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

  DELETE FROM working.purchases purchase
  WHERE purchase.id = ANY(p_purchase_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_items) submitted
      WHERE (submitted ->> 'id')::BIGINT = purchase.id
    );

  RETURN QUERY
  UPDATE working.purchases purchase
  SET fish_variety_id = submitted.fish_variety_id,
      quantity_crates = submitted.quantity_crates,
      quantity_kg = submitted.quantity_kg
  FROM jsonb_to_recordset(p_items) AS submitted(
    id BIGINT,
    fish_variety_id BIGINT,
    quantity_crates INTEGER,
    quantity_kg NUMERIC
  )
  WHERE purchase.id = submitted.id
  RETURNING purchase.*;
END;
$$;

REVOKE ALL ON FUNCTION working.update_purchase_group(BIGINT[], JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.update_purchase_group(BIGINT[], JSONB) TO authenticated;
