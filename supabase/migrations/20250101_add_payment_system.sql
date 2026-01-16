-- ============================================
-- Payment System Migration
-- Adds comprehensive payment tracking and billing enhancements
-- ============================================

-- Step 1: Add payment tracking columns to bills table
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS balance_due DECIMAL(10, 2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unpaid' NOT NULL;

-- Update any NULL status values to 'unpaid'
UPDATE bills SET status = 'unpaid' WHERE status IS NULL;

-- Update any invalid status values to 'unpaid'
UPDATE bills
SET status = 'unpaid'
WHERE status NOT IN ('unpaid', 'partial', 'paid');

-- Add check constraint for status (drop first if exists)
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_status_check;
ALTER TABLE bills
ADD CONSTRAINT bills_status_check
CHECK (status IN ('unpaid', 'partial', 'paid'));

-- Step 2: Create payments table (or add columns if exists)
DO $$
BEGIN
  -- Check if payments table exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'payments') THEN
    -- Create new table
    CREATE TABLE payments (
      id BIGSERIAL PRIMARY KEY,
      customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      payment_date DATE NOT NULL,
      amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
      payment_method VARCHAR(50) NOT NULL DEFAULT 'cash',
      reference_number VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  ELSE
    -- Table exists, ensure columns exist
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id BIGINT;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date DATE;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount DECIMAL(10, 2);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash';
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Update any NULL payment_method values to 'cash'
UPDATE payments SET payment_method = 'cash' WHERE payment_method IS NULL;

-- Update any invalid payment_method values to 'other'
UPDATE payments
SET payment_method = 'other'
WHERE payment_method NOT IN ('cash', 'bank_transfer', 'upi', 'cheque', 'other');

-- Now add the constraint (drop first if exists)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments
ADD CONSTRAINT payments_method_check
CHECK (payment_method IN ('cash', 'bank_transfer', 'upi', 'cheque', 'other'));

-- Step 3: Create payment_allocations table (links payments to bills)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  bill_id BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(10, 2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Create other_charges table for bill adjustments (packing, ice, transport)
CREATE TABLE IF NOT EXISTS bill_other_charges (
  id BIGSERIAL PRIMARY KEY,
  bill_id BIGINT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  charge_type VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add check constraint for charge types
ALTER TABLE bill_other_charges
ADD CONSTRAINT charge_type_check
CHECK (charge_type IN ('packing', 'ice', 'transport', 'loading', 'unloading', 'other'));

-- Step 5: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_bill_id ON payment_allocations(bill_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bill_other_charges_bill_id ON bill_other_charges(bill_id);

-- Step 6: Create trigger to update bills.updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Create function to auto-calculate bill status and balance_due
CREATE OR REPLACE FUNCTION update_bill_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_allocated DECIMAL(10, 2);
  v_bill_total DECIMAL(10, 2);
  v_new_status VARCHAR(20);
BEGIN
  -- Get total allocated amount for this bill
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_total_allocated
  FROM payment_allocations
  WHERE bill_id = NEW.bill_id;

  -- Get bill total
  SELECT total INTO v_bill_total
  FROM bills
  WHERE id = NEW.bill_id;

  -- Calculate balance due
  v_bill_total := COALESCE(v_bill_total, 0);

  -- Determine status
  IF v_total_allocated = 0 THEN
    v_new_status := 'unpaid';
  ELSIF v_total_allocated >= v_bill_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Update bill
  UPDATE bills
  SET
    amount_paid = v_total_allocated,
    balance_due = v_bill_total - v_total_allocated,
    status = v_new_status
  WHERE id = NEW.bill_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment allocations
CREATE TRIGGER update_bill_on_allocation_insert
AFTER INSERT ON payment_allocations
FOR EACH ROW
EXECUTE FUNCTION update_bill_payment_status();

CREATE TRIGGER update_bill_on_allocation_update
AFTER UPDATE ON payment_allocations
FOR EACH ROW
EXECUTE FUNCTION update_bill_payment_status();

-- Step 8: Create function for when allocation is deleted
CREATE OR REPLACE FUNCTION update_bill_on_allocation_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_total_allocated DECIMAL(10, 2);
  v_bill_total DECIMAL(10, 2);
  v_new_status VARCHAR(20);
BEGIN
  -- Get total allocated amount for this bill (excluding the deleted one)
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_total_allocated
  FROM payment_allocations
  WHERE bill_id = OLD.bill_id;

  -- Get bill total
  SELECT total INTO v_bill_total
  FROM bills
  WHERE id = OLD.bill_id;

  v_bill_total := COALESCE(v_bill_total, 0);

  -- Determine status
  IF v_total_allocated = 0 THEN
    v_new_status := 'unpaid';
  ELSIF v_total_allocated >= v_bill_total THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Update bill
  UPDATE bills
  SET
    amount_paid = v_total_allocated,
    balance_due = v_bill_total - v_total_allocated,
    status = v_new_status
  WHERE id = OLD.bill_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bill_on_allocation_delete
AFTER DELETE ON payment_allocations
FOR EACH ROW
EXECUTE FUNCTION update_bill_on_allocation_delete();

-- Step 9: Initialize existing bills with payment status
-- Set balance_due = total and status = 'unpaid' for all existing bills
UPDATE bills
SET
  amount_paid = 0,
  balance_due = total,
  status = 'unpaid'
WHERE amount_paid IS NULL OR balance_due IS NULL OR status IS NULL;

-- Step 10: Add comments for documentation
COMMENT ON TABLE payments IS 'Records all payments received from customers';
COMMENT ON TABLE payment_allocations IS 'Links payments to specific bills for allocation tracking';
COMMENT ON TABLE bill_other_charges IS 'Additional charges on bills (packing, ice, transport, etc.)';
COMMENT ON COLUMN bills.amount_paid IS 'Total amount paid against this bill';
COMMENT ON COLUMN bills.balance_due IS 'Remaining amount to be paid';
COMMENT ON COLUMN bills.status IS 'Payment status: unpaid, partial, or paid';

-- Step 11: Grant permissions (adjust based on your RLS policies)
-- This is a template - adjust according to your security requirements
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE bill_other_charges ENABLE ROW LEVEL SECURITY;

-- End of migration
