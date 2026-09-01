BEGIN;

ALTER TABLE working.cash_day_closings
  ADD COLUMN IF NOT EXISTS readiness_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS lock_version SMALLINT NOT NULL DEFAULT 2;

CREATE OR REPLACE FUNCTION working.assert_business_day_open(
  p_business_date DATE,
  p_context TEXT DEFAULT 'transaction'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
BEGIN
  IF p_business_date IS NULL THEN
    RAISE EXCEPTION 'Business date is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM working.cash_day_closings
    WHERE business_date = p_business_date
      AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Business day % is closed. Reopen it before changing %.', p_business_date, p_context
      USING ERRCODE = '55000';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION working.guard_locked_business_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  old_date DATE;
  new_date DATE;
  old_business JSONB;
  new_business JSONB;
BEGIN
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'bills' THEN
    old_business := to_jsonb(OLD) - ARRAY['amount_paid', 'balance_due', 'status', 'is_active', 'updated_at'];
    new_business := to_jsonb(NEW) - ARRAY['amount_paid', 'balance_due', 'status', 'is_active', 'updated_at'];
    IF old_business = new_business THEN RETURN NEW; END IF;
  ELSIF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'purchase_bills' THEN
    old_business := to_jsonb(OLD) - ARRAY['amount_paid', 'balance_due', 'payment_status', 'updated_at'];
    new_business := to_jsonb(NEW) - ARRAY['amount_paid', 'balance_due', 'payment_status', 'updated_at'];
    IF old_business = new_business THEN RETURN NEW; END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_date := (to_jsonb(OLD) ->> TG_ARGV[0])::DATE;
    PERFORM working.assert_business_day_open(old_date, TG_TABLE_NAME);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_date := (to_jsonb(NEW) ->> TG_ARGV[0])::DATE;
    IF old_date IS DISTINCT FROM new_date THEN
      PERFORM working.assert_business_day_open(new_date, TG_TABLE_NAME);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION working.guard_locked_related_business_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  relation_kind TEXT := TG_ARGV[0];
  old_id BIGINT;
  new_id BIGINT;
  old_date DATE;
  new_date DATE;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_id := CASE relation_kind
      WHEN 'sale' THEN (to_jsonb(OLD) ->> 'sale_id')::BIGINT
      WHEN 'bill' THEN (to_jsonb(OLD) ->> 'bill_id')::BIGINT
      WHEN 'purchase' THEN (to_jsonb(OLD) ->> 'purchase_id')::BIGINT
      ELSE NULL
    END;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_id := CASE relation_kind
      WHEN 'sale' THEN (to_jsonb(NEW) ->> 'sale_id')::BIGINT
      WHEN 'bill' THEN (to_jsonb(NEW) ->> 'bill_id')::BIGINT
      WHEN 'purchase' THEN (to_jsonb(NEW) ->> 'purchase_id')::BIGINT
      ELSE NULL
    END;
  END IF;

  IF relation_kind = 'sale' THEN
    IF old_id IS NOT NULL THEN SELECT sale_date INTO old_date FROM working.sales WHERE id = old_id; END IF;
    IF new_id IS NOT NULL THEN SELECT sale_date INTO new_date FROM working.sales WHERE id = new_id; END IF;
  ELSIF relation_kind = 'bill' THEN
    IF old_id IS NOT NULL THEN SELECT bill_date INTO old_date FROM working.bills WHERE id = old_id; END IF;
    IF new_id IS NOT NULL THEN SELECT bill_date INTO new_date FROM working.bills WHERE id = new_id; END IF;
  ELSIF relation_kind = 'purchase' THEN
    IF old_id IS NOT NULL THEN SELECT purchase_date INTO old_date FROM working.purchases WHERE id = old_id; END IF;
    IF new_id IS NOT NULL THEN SELECT purchase_date INTO new_date FROM working.purchases WHERE id = new_id; END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported business-day relation: %', relation_kind;
  END IF;

  IF old_date IS NOT NULL THEN
    PERFORM working.assert_business_day_open(old_date, TG_TABLE_NAME);
  END IF;
  IF new_date IS NOT NULL AND old_date IS DISTINCT FROM new_date THEN
    PERFORM working.assert_business_day_open(new_date, TG_TABLE_NAME);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION working.get_day_close_readiness(p_business_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  modules JSONB;
  closing_id_value BIGINT;
  purchase_count_value INTEGER;
  unbilled_purchase_value INTEGER := 0;
  sale_count_value INTEGER;
  unbilled_sale_value INTEGER := 0;
  unpacked_sale_value INTEGER := 0;
  invalid_purchase_rate_value INTEGER := 0;
  invalid_sale_rate_value INTEGER := 0;
  negative_stock_value INTEGER := 0;
  purchase_bill_count_value INTEGER;
  purchase_outstanding_value NUMERIC(14,2);
  sales_bill_count_value INTEGER;
  customer_outstanding_value NUMERIC(14,2);
  blocker_count_value INTEGER;
  warning_count_value INTEGER;
  issues_value JSONB := '[]'::JSONB;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can view day-close readiness' USING ERRCODE = '42501';
  END IF;
  IF p_business_date IS NULL THEN RAISE EXCEPTION 'Business date is required'; END IF;

  SELECT enabled_modules INTO modules
  FROM working.business_preferences
  WHERE id = 1;
  modules := coalesce(modules, '{}'::JSONB);

  SELECT id INTO closing_id_value
  FROM working.cash_day_closings
  WHERE business_date = p_business_date AND voided_at IS NULL
  ORDER BY id DESC LIMIT 1;

  SELECT count(*) INTO purchase_count_value
  FROM working.purchases WHERE purchase_date = p_business_date;
  SELECT count(*) INTO sale_count_value
  FROM working.sales WHERE sale_date = p_business_date;

  IF coalesce((modules ->> 'supplier_billing')::BOOLEAN, TRUE) THEN
    SELECT count(*) INTO unbilled_purchase_value
    FROM working.purchases
    WHERE purchase_date = p_business_date AND billing_status = 'unbilled';

    SELECT count(*) INTO invalid_purchase_rate_value
    FROM working.purchase_bill_items item
    JOIN working.purchase_bills bill ON bill.id = item.purchase_bill_id
    WHERE bill.bill_date = p_business_date
      AND (item.rate_per_kg <= 0 OR item.billable_weight <= 0);
  END IF;

  IF coalesce((modules ->> 'customer_billing')::BOOLEAN, TRUE) THEN
    SELECT count(*) INTO unbilled_sale_value
    FROM working.sales
    WHERE sale_date = p_business_date AND billing_status = 'unbilled';

    SELECT count(*) INTO invalid_sale_rate_value
    FROM working.bill_items item
    JOIN working.bills bill ON bill.id = item.bill_id
    WHERE bill.bill_date = p_business_date
      AND (item.rate_per_kg <= 0 OR item.amount <= 0);
  END IF;

  IF coalesce((modules ->> 'packing')::BOOLEAN, FALSE) THEN
    SELECT count(*) INTO unpacked_sale_value
    FROM working.sales sale
    LEFT JOIN working.packing_status packing ON packing.sale_id = sale.id
    WHERE sale.sale_date = p_business_date
      AND coalesce(packing.loaded, FALSE) = FALSE;
  END IF;

  SELECT count(*) INTO negative_stock_value
  FROM (
    SELECT item_variant_id, location_id
    FROM working.stock_movements
    WHERE movement_date <= p_business_date AND voided_at IS NULL
    GROUP BY item_variant_id, location_id
    HAVING sum(crates_delta) < 0 OR sum(kg_delta) < 0
  ) negative_stock;

  SELECT count(*), coalesce(sum(balance_due), 0)
  INTO purchase_bill_count_value, purchase_outstanding_value
  FROM working.purchase_bills
  WHERE bill_date = p_business_date AND balance_due > 0;

  SELECT count(*), coalesce(sum(GREATEST(total, 0)), 0)
  INTO sales_bill_count_value, customer_outstanding_value
  FROM working.bills
  WHERE bill_date = p_business_date AND total > 0;

  IF unbilled_purchase_value > 0 THEN
    issues_value := issues_value || jsonb_build_array(jsonb_build_object(
      'severity', 'blocker', 'code', 'unbilled_purchases',
      'label', 'Purchases waiting for bills', 'count', unbilled_purchase_value
    ));
  END IF;
  IF unbilled_sale_value > 0 THEN
    issues_value := issues_value || jsonb_build_array(jsonb_build_object(
      'severity', 'blocker', 'code', 'unbilled_sales',
      'label', 'Sales waiting for bills', 'count', unbilled_sale_value
    ));
  END IF;
  IF unpacked_sale_value > 0 THEN
    issues_value := issues_value || jsonb_build_array(jsonb_build_object(
      'severity', 'blocker', 'code', 'unpacked_sales',
      'label', 'Sales not marked loaded', 'count', unpacked_sale_value
    ));
  END IF;
  IF invalid_purchase_rate_value > 0 THEN
    issues_value := issues_value || jsonb_build_array(jsonb_build_object(
      'severity', 'blocker', 'code', 'invalid_purchase_rates',
      'label', 'Purchase items missing valid rates', 'count', invalid_purchase_rate_value
    ));
  END IF;
  IF invalid_sale_rate_value > 0 THEN
    issues_value := issues_value || jsonb_build_array(jsonb_build_object(
      'severity', 'blocker', 'code', 'invalid_sale_rates',
      'label', 'Sales items missing valid rates', 'count', invalid_sale_rate_value
    ));
  END IF;
  IF negative_stock_value > 0 THEN
    issues_value := issues_value || jsonb_build_array(jsonb_build_object(
      'severity', 'blocker', 'code', 'negative_stock',
      'label', 'Items with negative stock', 'count', negative_stock_value
    ));
  END IF;
  IF purchase_bill_count_value > 0 THEN
    issues_value := issues_value || jsonb_build_array(jsonb_build_object(
      'severity', 'warning', 'code', 'supplier_outstanding',
      'label', 'Supplier bills still payable', 'count', purchase_bill_count_value,
      'amount', purchase_outstanding_value
    ));
  END IF;
  IF sales_bill_count_value > 0 THEN
    issues_value := issues_value || jsonb_build_array(jsonb_build_object(
      'severity', 'warning', 'code', 'customer_outstanding',
      'label', 'Customer balances still receivable', 'count', sales_bill_count_value,
      'amount', customer_outstanding_value
    ));
  END IF;

  SELECT count(*) FILTER (WHERE issue ->> 'severity' = 'blocker'),
         count(*) FILTER (WHERE issue ->> 'severity' = 'warning')
  INTO blocker_count_value, warning_count_value
  FROM jsonb_array_elements(issues_value) issue;

  RETURN jsonb_build_object(
    'business_date', p_business_date,
    'status', CASE
      WHEN closing_id_value IS NOT NULL THEN 'closed'
      WHEN blocker_count_value > 0 THEN 'blocked'
      ELSE 'ready'
    END,
    'is_closed', closing_id_value IS NOT NULL,
    'can_close', closing_id_value IS NULL AND blocker_count_value = 0,
    'blocker_count', blocker_count_value,
    'warning_count', warning_count_value,
    'issues', issues_value,
    'activity', jsonb_build_object(
      'purchases', purchase_count_value,
      'sales', sale_count_value,
      'purchase_bills', purchase_bill_count_value,
      'sales_bills', sales_bill_count_value
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION working.close_cash_day(
  p_business_date DATE,
  p_counted_cash NUMERIC,
  p_notes TEXT DEFAULT NULL
)
RETURNS working.cash_day_closings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  summary_value JSONB;
  readiness_value JSONB;
  closing_value working.cash_day_closings%ROWTYPE;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can close a business day' USING ERRCODE = '42501';
  END IF;
  IF p_business_date IS NULL OR p_business_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Business day cannot be in the future';
  END IF;
  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'Counted cash cannot be negative';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('working-cash-day:' || p_business_date::TEXT, 0));
  IF EXISTS (
    SELECT 1 FROM working.cash_day_closings
    WHERE business_date = p_business_date AND voided_at IS NULL
  ) THEN RAISE EXCEPTION 'Business day is already closed'; END IF;
  IF EXISTS (
    SELECT 1 FROM working.cash_day_closings
    WHERE business_date > p_business_date AND voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A later business day is already closed. Close days in chronological order.';
  END IF;

  summary_value := working.get_cashbook_day(p_business_date);
  readiness_value := working.get_day_close_readiness(p_business_date);

  IF (summary_value ->> 'expected_closing_cash')::NUMERIC < 0 THEN
    RAISE EXCEPTION 'Expected cash is negative. Record the missing opening cash or correct cash transactions before closing.';
  END IF;
  IF (readiness_value ->> 'blocker_count')::INTEGER > 0 THEN
    RAISE EXCEPTION 'Resolve % blocking day-close checks before closing.', readiness_value ->> 'blocker_count';
  END IF;

  INSERT INTO working.cash_day_closings (
    business_date, opening_cash, cash_received, cash_supplier_payments,
    cash_expenses, cash_adjustments_in, cash_adjustments_out,
    expected_closing_cash, counted_cash, notes, closed_by,
    readiness_snapshot, lock_version
  ) VALUES (
    p_business_date,
    (summary_value ->> 'opening_cash')::NUMERIC,
    (summary_value ->> 'cash_received')::NUMERIC,
    (summary_value ->> 'cash_supplier_payments')::NUMERIC,
    (summary_value ->> 'cash_expenses')::NUMERIC,
    (summary_value ->> 'cash_adjustments_in')::NUMERIC,
    (summary_value ->> 'cash_adjustments_out')::NUMERIC,
    (summary_value ->> 'expected_closing_cash')::NUMERIC,
    round(p_counted_cash, 2), nullif(btrim(p_notes), ''), auth.uid(),
    readiness_value, 2
  ) RETURNING * INTO closing_value;

  RETURN closing_value;
END;
$$;

CREATE TRIGGER lock_day_purchases
BEFORE INSERT OR UPDATE OR DELETE ON working.purchases
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_business_date('purchase_date');
CREATE TRIGGER lock_day_sales
BEFORE INSERT OR UPDATE OR DELETE ON working.sales
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_business_date('sale_date');
CREATE TRIGGER lock_day_purchase_bills
BEFORE INSERT OR UPDATE OR DELETE ON working.purchase_bills
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_business_date('bill_date');
CREATE TRIGGER lock_day_customer_bills
BEFORE INSERT OR UPDATE OR DELETE ON working.bills
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_business_date('bill_date');
CREATE TRIGGER lock_day_customer_payments
BEFORE INSERT OR UPDATE OR DELETE ON working.payments
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_business_date('payment_date');
CREATE TRIGGER lock_day_supplier_payments
BEFORE INSERT OR UPDATE OR DELETE ON working.purchase_bill_payments
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_business_date('payment_date');
CREATE TRIGGER lock_day_expenses
BEFORE INSERT OR UPDATE OR DELETE ON working.expenses
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_business_date('expense_date');
CREATE TRIGGER lock_day_cash_adjustments
BEFORE INSERT OR UPDATE OR DELETE ON working.cash_adjustments
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_business_date('business_date');
CREATE TRIGGER lock_day_stock_movements
BEFORE INSERT OR UPDATE OR DELETE ON working.stock_movements
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_business_date('movement_date');

CREATE TRIGGER lock_day_packing_status
BEFORE INSERT OR UPDATE OR DELETE ON working.packing_status
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_related_business_date('sale');
CREATE TRIGGER lock_day_bill_items
BEFORE INSERT OR UPDATE OR DELETE ON working.bill_items
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_related_business_date('bill');
CREATE TRIGGER lock_day_bill_other_charges
BEFORE INSERT OR UPDATE OR DELETE ON working.bill_other_charges
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_related_business_date('bill');
CREATE TRIGGER lock_day_bill_item_sales
BEFORE INSERT OR UPDATE OR DELETE ON working.bill_item_sales
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_related_business_date('sale');
CREATE TRIGGER lock_day_purchase_bill_items
BEFORE INSERT OR UPDATE OR DELETE ON working.purchase_bill_items
FOR EACH ROW EXECUTE FUNCTION working.guard_locked_related_business_date('purchase');

REVOKE ALL ON FUNCTION working.assert_business_day_open(DATE, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION working.guard_locked_business_date() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION working.guard_locked_related_business_date() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION working.get_day_close_readiness(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.get_day_close_readiness(DATE) TO authenticated;
REVOKE ALL ON FUNCTION working.close_cash_day(DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.close_cash_day(DATE, NUMERIC, TEXT) TO authenticated;

COMMENT ON FUNCTION working.get_day_close_readiness(DATE) IS
  'Production pre-close checklist. Operational exceptions block closing; credit balances remain warnings.';
COMMENT ON COLUMN working.cash_day_closings.readiness_snapshot IS
  'Immutable checklist captured at close time for operational audit.';

COMMIT;
