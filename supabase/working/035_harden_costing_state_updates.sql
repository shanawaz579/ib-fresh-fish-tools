BEGIN;

CREATE OR REPLACE FUNCTION working.rebuild_inventory_costing()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  run_value working.inventory_costing_runs%ROWTYPE;
  event_value RECORD;
  state_known_qty NUMERIC(18,6);
  state_known_cost NUMERIC(18,6);
  state_unknown_qty NUMERIC(18,6);
  state_available_qty NUMERIC(18,6);
  state_average_cost NUMERIC(18,6);
  state_known_consumed NUMERIC(18,6);
  event_cost NUMERIC(18,2);
  event_cost_status TEXT;
  event_profit NUMERIC(18,2);
  actor_id UUID := auth.uid();
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can refresh inventory costing' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('working-inventory-costing', 0));
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = actor_id) THEN
    actor_id := NULL;
  END IF;

  INSERT INTO working.inventory_costing_runs (created_by, source_purchase_count, source_sale_count)
  VALUES (
    actor_id,
    (SELECT count(*) FROM working.purchase_cost_sources),
    (SELECT count(*) FROM working.sale_revenue_sources)
  )
  RETURNING * INTO run_value;

  CREATE TEMP TABLE costing_state (
    item_variant_id BIGINT PRIMARY KEY,
    known_qty NUMERIC(18,6) NOT NULL DEFAULT 0,
    known_cost NUMERIC(18,6) NOT NULL DEFAULT 0,
    unknown_qty NUMERIC(18,6) NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  FOR event_value IN
    SELECT * FROM (
      SELECT
        'purchase'::TEXT AS event_type,
        source_id,
        event_date,
        item_variant_id,
        item_name,
        counterparty_name,
        quantity_kg,
        landed_cost AS source_cost,
        NULL::NUMERIC AS source_revenue,
        source_status,
        'not_applicable'::TEXT AS revenue_status,
        0 AS event_order
      FROM working.purchase_cost_sources
      UNION ALL
      SELECT
        'sale',
        source_id,
        event_date,
        item_variant_id,
        item_name,
        counterparty_name,
        quantity_kg,
        NULL,
        revenue,
        NULL,
        revenue_status,
        1
      FROM working.sale_revenue_sources
    ) event_stream
    ORDER BY event_date, event_order, source_id
  LOOP
    INSERT INTO costing_state (item_variant_id)
    VALUES (event_value.item_variant_id)
    ON CONFLICT (item_variant_id) DO NOTHING;

    SELECT state.known_qty, state.known_cost, state.unknown_qty
    INTO state_known_qty, state_known_cost, state_unknown_qty
    FROM costing_state state
    WHERE state.item_variant_id = event_value.item_variant_id
    FOR UPDATE;

    IF event_value.event_type = 'purchase' THEN
      IF event_value.source_cost IS NULL THEN
        state_unknown_qty := state_unknown_qty + event_value.quantity_kg;
      ELSE
        state_known_qty := state_known_qty + event_value.quantity_kg;
        state_known_cost := state_known_cost + event_value.source_cost;
      END IF;

      UPDATE costing_state state
      SET known_qty = state_known_qty,
          known_cost = state_known_cost,
          unknown_qty = state_unknown_qty
      WHERE state.item_variant_id = event_value.item_variant_id;

      INSERT INTO working.inventory_cost_events (
        run_id, event_type, source_id, event_date, item_variant_id, item_name,
        counterparty_name, quantity_kg, unit_cost, total_cost, revenue,
        gross_profit, cost_status, revenue_status
      ) VALUES (
        run_value.id,
        'purchase',
        event_value.source_id,
        event_value.event_date,
        event_value.item_variant_id,
        event_value.item_name,
        event_value.counterparty_name,
        event_value.quantity_kg,
        CASE
          WHEN event_value.source_cost IS NULL THEN NULL
          ELSE event_value.source_cost / NULLIF(event_value.quantity_kg, 0)
        END,
        event_value.source_cost,
        NULL,
        NULL,
        event_value.source_status,
        'not_applicable'
      );
    ELSE
      state_available_qty := state_known_qty + state_unknown_qty;
      state_average_cost := CASE
        WHEN state_known_qty > 0 THEN state_known_cost / state_known_qty
        ELSE NULL
      END;
      event_cost := NULL;

      IF event_value.quantity_kg > state_available_qty OR state_available_qty <= 0 THEN
        event_cost_status := 'insufficient_stock';
        state_known_qty := 0;
        state_known_cost := 0;
        state_unknown_qty := 0;
      ELSIF state_unknown_qty > 0 THEN
        event_cost_status := 'missing_purchase_cost';
        state_known_consumed := event_value.quantity_kg * state_known_qty / state_available_qty;
        IF state_average_cost IS NOT NULL THEN
          state_known_cost := GREATEST(0, state_known_cost - state_known_consumed * state_average_cost);
        END IF;
        state_known_qty := GREATEST(0, state_known_qty - state_known_consumed);
        state_unknown_qty := GREATEST(0, state_unknown_qty - (event_value.quantity_kg - state_known_consumed));
      ELSE
        event_cost_status := 'costed';
        event_cost := ROUND(event_value.quantity_kg * state_average_cost, 2);
        state_known_qty := GREATEST(0, state_known_qty - event_value.quantity_kg);
        state_known_cost := GREATEST(0, state_known_cost - event_cost);
      END IF;

      event_profit := CASE
        WHEN event_cost_status = 'costed' AND event_value.revenue_status = 'billed'
          THEN event_value.source_revenue - event_cost
        ELSE NULL
      END;

      UPDATE costing_state state
      SET known_qty = state_known_qty,
          known_cost = state_known_cost,
          unknown_qty = state_unknown_qty
      WHERE state.item_variant_id = event_value.item_variant_id;

      INSERT INTO working.inventory_cost_events (
        run_id, event_type, source_id, event_date, item_variant_id, item_name,
        counterparty_name, quantity_kg, unit_cost, total_cost, revenue,
        gross_profit, cost_status, revenue_status
      ) VALUES (
        run_value.id,
        'sale',
        event_value.source_id,
        event_value.event_date,
        event_value.item_variant_id,
        event_value.item_name,
        event_value.counterparty_name,
        event_value.quantity_kg,
        CASE WHEN event_cost IS NULL THEN NULL ELSE event_cost / NULLIF(event_value.quantity_kg, 0) END,
        event_cost,
        event_value.source_revenue,
        event_profit,
        event_cost_status,
        event_value.revenue_status
      );
    END IF;
  END LOOP;

  UPDATE working.inventory_costing_runs
  SET completed_at = NOW()
  WHERE id = run_value.id;

  RETURN run_value.id;
END;
$$;

REVOKE ALL ON FUNCTION working.rebuild_inventory_costing() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION working.rebuild_inventory_costing() IS
  'Private full weighted-average rebuild with unambiguous inventory state assignments.';

COMMIT;
