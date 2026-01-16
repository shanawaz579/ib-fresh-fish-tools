-- Add location and secondary_name fields to purchases table
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS location VARCHAR(200),
ADD COLUMN IF NOT EXISTS secondary_name VARCHAR(200);

-- Add comments for documentation
COMMENT ON COLUMN purchases.location IS 'Location where the purchase was made or delivered';
COMMENT ON COLUMN purchases.secondary_name IS 'Secondary or alternate name for the farmer';

-- Create index for location for faster searches
CREATE INDEX IF NOT EXISTS idx_purchases_location ON purchases(location);
