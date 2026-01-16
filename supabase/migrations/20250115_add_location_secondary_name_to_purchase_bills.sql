-- Add location and secondary_name fields to purchase_bills table
ALTER TABLE purchase_bills
ADD COLUMN IF NOT EXISTS location VARCHAR(200),
ADD COLUMN IF NOT EXISTS secondary_name VARCHAR(200);

-- Add comments for documentation
COMMENT ON COLUMN purchase_bills.location IS 'Location where the purchase was made or delivered';
COMMENT ON COLUMN purchase_bills.secondary_name IS 'Secondary or alternate name for the farmer';

-- Create index for location for faster searches
CREATE INDEX IF NOT EXISTS idx_purchase_bills_location ON purchase_bills(location);
