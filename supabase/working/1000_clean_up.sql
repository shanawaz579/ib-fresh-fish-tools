BEGIN;

-- Safety check: stop if the isolated schema is unavailable.
DO $$
BEGIN
  IF to_regnamespace('working') IS NULL THEN
    RAISE EXCEPTION 'working schema not found — cleanup cancelled';
  END IF;
END
$$;

TRUNCATE TABLE
  working.bill_corrections,
  working.bill_item_sales,
  working.bill_other_charges,
  working.bill_items,
  working.payments,
  working.bills,
  working.purchase_bill_payments,
  working.purchase_bill_items,
  working.purchase_bills,
  working.packing_status,
  working.stock_movements,
  working.sales,
  working.purchases,
  working.expenses,
  working.cash_adjustments,
  working.cash_day_closings,
  working.inventory_cost_events,
  working.inventory_costing_control,
  working.inventory_costing_runs
RESTART IDENTITY;

-- Restore the required costing-control singleton.
INSERT INTO working.inventory_costing_control (
  id,
  is_dirty,
  dirty_since,
  last_completed_run_id,
  updated_at
)
VALUES (1, TRUE, NOW(), NULL, NOW());

COMMIT;