-- Create packing_status table to track loaded status of sales
CREATE TABLE IF NOT EXISTS packing_status (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    loaded BOOLEAN NOT NULL DEFAULT false,
    loaded_at TIMESTAMPTZ,
    loaded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sale_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_packing_status_sale_id ON packing_status(sale_id);
CREATE INDEX IF NOT EXISTS idx_packing_status_loaded ON packing_status(loaded);

-- Enable Row Level Security
ALTER TABLE packing_status ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read
CREATE POLICY "Allow authenticated users to read packing status"
    ON packing_status FOR SELECT
    TO authenticated
    USING (true);

-- Create policy to allow authenticated users to insert
CREATE POLICY "Allow authenticated users to insert packing status"
    ON packing_status FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create policy to allow authenticated users to update
CREATE POLICY "Allow authenticated users to update packing status"
    ON packing_status FOR UPDATE
    TO authenticated
    USING (true);

-- Create policy to allow authenticated users to delete
CREATE POLICY "Allow authenticated users to delete packing status"
    ON packing_status FOR DELETE
    TO authenticated
    USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_packing_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_packing_status_updated_at
    BEFORE UPDATE ON packing_status
    FOR EACH ROW
    EXECUTE FUNCTION update_packing_status_updated_at();
