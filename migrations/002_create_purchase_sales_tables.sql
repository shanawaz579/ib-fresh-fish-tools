-- Create fish_varieties table
CREATE TABLE public.fish_varieties (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create purchases table (bought from farmers)
CREATE TABLE public.purchases (
  id BIGSERIAL PRIMARY KEY,
  farmer_name VARCHAR(255) NOT NULL,
  fish_variety_id BIGINT NOT NULL REFERENCES public.fish_varieties(id),
  quantity_crates INTEGER NOT NULL DEFAULT 0,
  quantity_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create sales table (sold to customers)
CREATE TABLE public.sales (
  id BIGSERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  fish_variety_id BIGINT NOT NULL REFERENCES public.fish_varieties(id),
  quantity_crates INTEGER NOT NULL DEFAULT 0,
  quantity_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.fish_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read" ON public.fish_varieties FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.purchases FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON public.sales FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.purchases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert" ON public.sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.purchases FOR UPDATE USING (true);
CREATE POLICY "Allow public update" ON public.sales FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.purchases FOR DELETE USING (true);
CREATE POLICY "Allow public delete" ON public.sales FOR DELETE USING (true);

-- Create indexes
CREATE INDEX idx_purchases_date ON public.purchases(purchase_date DESC);
CREATE INDEX idx_sales_date ON public.sales(sale_date DESC);
CREATE INDEX idx_purchases_variety ON public.purchases(fish_variety_id);
CREATE INDEX idx_sales_variety ON public.sales(fish_variety_id);

-- Insert sample fish varieties
INSERT INTO public.fish_varieties (name) VALUES 
  ('Tilapia'),
  ('Catfish'),
  ('Carp'),
  ('Snakehead'),
  ('Pangasius');
