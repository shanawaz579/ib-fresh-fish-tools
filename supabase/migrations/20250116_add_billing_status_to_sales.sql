-- Add billing status tracking to sales table
-- This migration is SAFE and NON-BREAKING:
-- - Uses DEFAULT values so existing rows work fine
-- - Adds optional columns (nullable bill reference)
-- - All existing code will continue to work

-- Add billing_status column with default 'unbilled'
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) DEFAULT 'unbilled';

-- Add reference to the bill that includes this sale (nullable - optional link)
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS billed_in_bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN sales.billing_status IS 'Status of billing: unbilled, billed, or partial';
COMMENT ON COLUMN sales.billed_in_bill_id IS 'Reference to the sales bill that includes this sale';

-- Create index for faster queries on billing status
CREATE INDEX IF NOT EXISTS idx_sales_billing_status ON sales(billing_status);
CREATE INDEX IF NOT EXISTS idx_sales_billed_in_bill_id ON sales(billed_in_bill_id);

-- Add constraint to ensure valid billing_status values
ALTER TABLE sales
ADD CONSTRAINT check_sales_billing_status
CHECK (billing_status IN ('unbilled', 'billed', 'partial'));

-- Update existing sales to 'unbilled' (safe - they weren't tracked before)
UPDATE sales
SET billing_status = 'unbilled'
WHERE billing_status IS NULL;
