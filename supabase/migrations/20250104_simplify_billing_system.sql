-- ============================================
-- Simplify Billing System Migration
-- Removes payment_allocations complexity
-- Implements simple "active bill" system
-- ============================================

-- Step 1: Drop payment_allocations table and related triggers
DROP TRIGGER IF EXISTS update_bill_on_allocation_insert ON payment_allocations;
DROP TRIGGER IF EXISTS update_bill_on_allocation_update ON payment_allocations;
DROP TRIGGER IF EXISTS update_bill_on_allocation_delete ON payment_allocations;
DROP FUNCTION IF EXISTS update_bill_payment_status();
DROP FUNCTION IF EXISTS update_bill_on_allocation_delete();
DROP TABLE IF EXISTS payment_allocations CASCADE;

-- Step 2: Add is_active column to bills table
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Step 3: Update bills table structure
-- Remove old payment tracking columns that were added by previous migration
-- Keep: amount_paid, balance_due, status (we'll use them differently)
-- The status will now be simpler: 'unpaid' or 'paid' only

-- First, update any 'partial' status to 'unpaid' BEFORE adding constraint
UPDATE bills SET status = 'unpaid' WHERE status = 'partial';

-- Update any NULL or invalid status values to 'unpaid'
UPDATE bills SET status = 'unpaid' WHERE status IS NULL OR status NOT IN ('unpaid', 'paid');

-- Now drop old constraint and add new one
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_status_check;
ALTER TABLE bills
ADD CONSTRAINT bills_status_check
CHECK (status IN ('unpaid', 'paid'));

-- Step 4: Set only the latest bill as active for each customer
-- First, mark all bills as inactive
UPDATE bills SET is_active = false;

-- Then, mark only the latest bill for each customer as active
WITH latest_bills AS (
  SELECT DISTINCT ON (customer_id)
    id,
    customer_id
  FROM bills
  ORDER BY customer_id, bill_date DESC, id DESC
)
UPDATE bills
SET is_active = true
WHERE id IN (SELECT id FROM latest_bills);

-- Step 5: Payments table is already good - no changes needed
-- It has: customer_id, payment_date, amount, payment_method, reference_number, notes

-- Step 6: Create index on is_active for better query performance
CREATE INDEX IF NOT EXISTS idx_bills_is_active ON bills(is_active);
CREATE INDEX IF NOT EXISTS idx_bills_customer_active ON bills(customer_id, is_active);

-- Step 7: Create function to get payments between two dates for a customer
CREATE OR REPLACE FUNCTION get_customer_payments_between_dates(
  p_customer_id BIGINT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  payment_date DATE,
  amount DECIMAL(10, 2),
  payment_method VARCHAR(50),
  reference_number VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.payment_date,
    p.amount,
    p.payment_method,
    p.reference_number
  FROM payments p
  WHERE p.customer_id = p_customer_id
    AND p.payment_date > p_start_date
    AND p.payment_date <= p_end_date
  ORDER BY p.payment_date, p.id;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Add comments for documentation
COMMENT ON COLUMN bills.is_active IS 'Whether this is the current active bill for the customer (only 1 active bill per customer)';
COMMENT ON COLUMN bills.previous_balance IS 'Outstanding balance from previous bill';
COMMENT ON COLUMN bills.amount_paid IS 'Total payments received since previous bill';
COMMENT ON COLUMN bills.balance_due IS 'Outstanding amount after payments (previous_balance - amount_paid)';
COMMENT ON COLUMN bills.status IS 'Bill status: unpaid or paid';

COMMENT ON FUNCTION get_customer_payments_between_dates IS 'Get all payments made by a customer between two dates (exclusive start, inclusive end)';

-- Step 9: Create view for active bills with customer info
CREATE OR REPLACE VIEW active_bills_view AS
SELECT
  b.id,
  b.bill_number,
  b.customer_id,
  c.name as customer_name,
  b.bill_date,
  b.previous_balance,
  b.subtotal,
  b.discount,
  b.total,
  b.amount_paid,
  b.balance_due,
  b.status,
  b.notes
FROM bills b
JOIN customers c ON b.customer_id = c.id
WHERE b.is_active = true
ORDER BY b.bill_date DESC, b.id DESC;

COMMENT ON VIEW active_bills_view IS 'Shows all currently active bills with customer information';

-- End of migration
