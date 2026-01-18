-- Trigger to automatically update sales billing_status when bills are created/modified/deleted
-- This ensures sales status stays in sync with bills

-- Function to update sales billing status based on bill_items
CREATE OR REPLACE FUNCTION update_sales_billing_status()
RETURNS TRIGGER AS $$
DECLARE
  v_bill_id INTEGER;
  v_customer_id INTEGER;
  v_bill_date DATE;
BEGIN
  -- Determine which bill_id to work with
  IF TG_OP = 'DELETE' THEN
    v_bill_id := OLD.bill_id;
  ELSE
    v_bill_id := NEW.bill_id;
  END IF;

  -- Get customer_id and bill_date from bills table
  SELECT customer_id, bill_date INTO v_customer_id, v_bill_date
  FROM bills
  WHERE id = v_bill_id;

  -- If bill was deleted, v_customer_id will be NULL
  IF v_customer_id IS NULL AND TG_OP = 'DELETE' THEN
    -- Get customer_id from the deleted bill_item's bill (we need to store it)
    -- For now, we'll mark all sales as unbilled that match the deleted items
    UPDATE sales
    SET billing_status = 'unbilled',
        billed_in_bill_id = NULL
    WHERE billed_in_bill_id = v_bill_id;

    RETURN OLD;
  END IF;

  -- Mark sales as 'billed' if they match bill_items for this customer and date
  UPDATE sales s
  SET billing_status = 'billed',
      billed_in_bill_id = v_bill_id
  FROM bill_items bi
  WHERE bi.bill_id = v_bill_id
    AND s.customer_id = v_customer_id
    AND s.sale_date = v_bill_date
    AND s.fish_variety_id = bi.fish_variety_id
    AND s.quantity_crates = bi.quantity_crates
    AND s.quantity_kg = bi.quantity_kg;

  -- Mark any sales that were previously billed in this bill but are no longer in bill_items as unbilled
  UPDATE sales
  SET billing_status = 'unbilled',
      billed_in_bill_id = NULL
  WHERE billed_in_bill_id = v_bill_id
    AND id NOT IN (
      SELECT s.id
      FROM sales s
      JOIN bill_items bi ON bi.bill_id = v_bill_id
        AND s.fish_variety_id = bi.fish_variety_id
        AND s.quantity_crates = bi.quantity_crates
        AND s.quantity_kg = bi.quantity_kg
      WHERE s.customer_id = v_customer_id
        AND s.sale_date = v_bill_date
    );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on bill_items table
DROP TRIGGER IF EXISTS trigger_update_sales_billing_status ON bill_items;
CREATE TRIGGER trigger_update_sales_billing_status
AFTER INSERT OR UPDATE OR DELETE ON bill_items
FOR EACH ROW
EXECUTE FUNCTION update_sales_billing_status();

-- Also create a trigger for when bills are deleted entirely
CREATE OR REPLACE FUNCTION handle_bill_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark all sales that were billed in this bill as unbilled
  UPDATE sales
  SET billing_status = 'unbilled',
      billed_in_bill_id = NULL
  WHERE billed_in_bill_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_bill_deletion ON bills;
CREATE TRIGGER trigger_handle_bill_deletion
BEFORE DELETE ON bills
FOR EACH ROW
EXECUTE FUNCTION handle_bill_deletion();

-- Add a comment explaining the triggers
COMMENT ON FUNCTION update_sales_billing_status() IS 'Automatically updates sales billing_status when bill_items are created, modified, or deleted';
COMMENT ON FUNCTION handle_bill_deletion() IS 'Resets sales billing_status to unbilled when a bill is deleted';
