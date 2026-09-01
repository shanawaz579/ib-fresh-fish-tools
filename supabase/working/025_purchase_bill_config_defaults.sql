-- Keep persisted purchase-bill metadata aligned with the configured defaults.
-- Item-level billable weights remain authoritative for financial calculations.

CREATE OR REPLACE FUNCTION working.apply_purchase_bill_configuration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
BEGIN
  SELECT purchase_weight_deduction_percent
  INTO NEW.weight_deduction_percentage
  FROM working.business_preferences
  WHERE id = 1;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION working.apply_purchase_bill_configuration() FROM PUBLIC;

CREATE TRIGGER apply_business_configuration
BEFORE INSERT ON working.purchase_bills
FOR EACH ROW EXECUTE FUNCTION working.apply_purchase_bill_configuration();

COMMENT ON FUNCTION working.apply_purchase_bill_configuration() IS
  'Copies the configured purchase deduction percentage onto each new bill for immutable historical reporting.';
