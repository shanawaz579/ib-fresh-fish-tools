-- Function to update purchase bill payment status and amounts
CREATE OR REPLACE FUNCTION update_purchase_bill_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid DECIMAL(12, 2);
  v_bill_total DECIMAL(12, 2);
  v_balance DECIMAL(12, 2);
  v_status VARCHAR(20);
BEGIN
  -- Get the bill total
  SELECT total INTO v_bill_total
  FROM purchase_bills
  WHERE id = COALESCE(NEW.purchase_bill_id, OLD.purchase_bill_id);

  -- Calculate total payments for this bill
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM purchase_bill_payments
  WHERE purchase_bill_id = COALESCE(NEW.purchase_bill_id, OLD.purchase_bill_id);

  -- Calculate balance
  v_balance := v_bill_total - v_total_paid;

  -- Determine status
  IF v_balance <= 0 THEN
    v_status := 'paid';
    v_balance := 0;
  ELSIF v_total_paid > 0 THEN
    v_status := 'partial';
  ELSE
    v_status := 'pending';
  END IF;

  -- Update the purchase bill
  UPDATE purchase_bills
  SET
    amount_paid = v_total_paid,
    balance_due = v_balance,
    payment_status = v_status
  WHERE id = COALESCE(NEW.purchase_bill_id, OLD.purchase_bill_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_purchase_bill_payment_status ON purchase_bill_payments;

-- Create trigger for INSERT and DELETE on purchase_bill_payments
CREATE TRIGGER trigger_update_purchase_bill_payment_status
AFTER INSERT OR DELETE ON purchase_bill_payments
FOR EACH ROW
EXECUTE FUNCTION update_purchase_bill_payment_status();

-- Add comment
COMMENT ON FUNCTION update_purchase_bill_payment_status() IS 'Automatically updates purchase bill payment status, amount_paid, and balance_due when payments are added or deleted';
