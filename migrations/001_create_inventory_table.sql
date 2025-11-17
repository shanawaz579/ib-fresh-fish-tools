-- Create inventory table
CREATE TABLE public.inventory (
  id BIGSERIAL PRIMARY KEY,
  farmer VARCHAR(255) NOT NULL,
  fish_type VARCHAR(255) NOT NULL,
  crates INTEGER NOT NULL DEFAULT 0,
  loose_weight DECIMAL(10, 2) NOT NULL DEFAULT 0,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON public.inventory
  FOR SELECT USING (true);

-- Create policy to allow authenticated users to insert
CREATE POLICY "Allow authenticated users to insert" ON public.inventory
  FOR INSERT WITH CHECK (true);

-- Create policy to allow authenticated users to update
CREATE POLICY "Allow authenticated users to update" ON public.inventory
  FOR UPDATE USING (true);

-- Create policy to allow authenticated users to delete
CREATE POLICY "Allow authenticated users to delete" ON public.inventory
  FOR DELETE USING (true);

-- Create index on date for better query performance
CREATE INDEX idx_inventory_date ON public.inventory(date DESC);
