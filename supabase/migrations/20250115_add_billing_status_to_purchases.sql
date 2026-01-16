-- Add billing status tracking to purchases table
-- This migration is SAFE and NON-BREAKING:
-- - Uses DEFAULT values so existing rows work fine
-- - Adds optional columns (nullable bill reference)
-- - All existing code will continue to work

-- Add billing_status column with default 'unbilled'
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) DEFAULT 'unbilled';

-- Add reference to the bill that includes this purchase (nullable - optional link)
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS billed_in_bill_id INTEGER REFERENCES purchase_bills(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN purchases.billing_status IS 'Status of billing: unbilled, billed, or partial';
COMMENT ON COLUMN purchases.billed_in_bill_id IS 'Reference to the purchase bill that includes this purchase';

-- Create index for faster queries on billing status
CREATE INDEX IF NOT EXISTS idx_purchases_billing_status ON purchases(billing_status);
CREATE INDEX IF NOT EXISTS idx_purchases_billed_in_bill_id ON purchases(billed_in_bill_id);

-- Add constraint to ensure valid billing_status values
ALTER TABLE purchases
ADD CONSTRAINT check_billing_status
CHECK (billing_status IN ('unbilled', 'billed', 'partial'));

-- Update existing purchases to 'unbilled' (safe - they weren't tracked before)
UPDATE purchases
SET billing_status = 'unbilled'
WHERE billing_status IS NULL;