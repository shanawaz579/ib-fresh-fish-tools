-- ============================================
-- Fresh Fish Tools - Complete Database Setup
-- ============================================

-- 1. Create fish_varieties table
CREATE TABLE public.fish_varieties (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Create farmers table
CREATE TABLE public.farmers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  bank_account VARCHAR(50),
  bank_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Create customers table
CREATE TABLE public.customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  contact_person VARCHAR(255),
  business_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Create purchases table (bought from farmers)
CREATE TABLE public.purchases (
  id BIGSERIAL PRIMARY KEY,
  farmer_id BIGINT NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  fish_variety_id BIGINT NOT NULL REFERENCES public.fish_varieties(id) ON DELETE CASCADE,
  quantity_crates INTEGER NOT NULL DEFAULT 0,
  quantity_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Create sales table (sold to customers)
CREATE TABLE public.sales (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  fish_variety_id BIGINT NOT NULL REFERENCES public.fish_varieties(id) ON DELETE CASCADE,
  quantity_crates INTEGER NOT NULL DEFAULT 0,
  quantity_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE public.fish_varieties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Create RLS Policies for Public Access
-- ============================================

-- Fish Varieties Policies
CREATE POLICY "Allow public read fish_varieties" 
  ON public.fish_varieties 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert fish_varieties" 
  ON public.fish_varieties 
  FOR INSERT 
  WITH CHECK (true);

-- Farmers Policies
CREATE POLICY "Allow public read farmers" 
  ON public.farmers 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert farmers" 
  ON public.farmers 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update farmers"
  ON public.farmers
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete farmers"
  ON public.farmers
  FOR DELETE
  USING (true);

-- Customers Policies
CREATE POLICY "Allow public read customers" 
  ON public.customers 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert customers" 
  ON public.customers 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update customers"
  ON public.customers
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete customers"
  ON public.customers
  FOR DELETE
  USING (true);

-- Purchases Policies
CREATE POLICY "Allow public read purchases" 
  ON public.purchases 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert purchases" 
  ON public.purchases 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update purchases" 
  ON public.purchases 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete purchases" 
  ON public.purchases 
  FOR DELETE 
  USING (true);

-- Sales Policies
CREATE POLICY "Allow public read sales" 
  ON public.sales 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert sales" 
  ON public.sales 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update sales" 
  ON public.sales 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete sales" 
  ON public.sales 
  FOR DELETE 
  USING (true);

-- ============================================
-- Create Indexes for Performance
-- ============================================
CREATE INDEX idx_farmers_name ON public.farmers(name);
CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_purchases_date ON public.purchases(purchase_date DESC);
CREATE INDEX idx_purchases_variety ON public.purchases(fish_variety_id);
CREATE INDEX idx_purchases_farmer ON public.purchases(farmer_id);

CREATE INDEX idx_sales_date ON public.sales(sale_date DESC);
CREATE INDEX idx_sales_variety ON public.sales(fish_variety_id);
CREATE INDEX idx_sales_customer ON public.sales(customer_id);

-- ============================================
-- Insert Sample Data
-- ============================================

-- Sample Farmers
INSERT INTO public.farmers (name, phone, email, address, city, state, bank_account, bank_name, notes) VALUES 
  ('Farmer Ahmad', '9876543210', 'ahmad@farm.com', 'Pond Area, Nellore', 'Nellore', 'Andhra Pradesh', '1234567890', 'ICICI Bank', 'Regular supplier'),
  ('Farmer Hassan', '9876543211', 'hassan@farm.com', 'Fish Ponds, Nellore', 'Nellore', 'Andhra Pradesh', '1234567891', 'HDFC Bank', 'Organic farming'),
  ('Farmer Ali', '9876543212', 'ali@farm.com', 'Aqua Zone, Nellore', 'Nellore', 'Andhra Pradesh', '1234567892', 'SBI Bank', 'Tilapia specialist'),
  ('Farmer Mohammed', '9876543213', 'mohammed@farm.com', 'Water Tank Area, Nellore', 'Nellore', 'Andhra Pradesh', '1234567893', 'Axis Bank', 'Catfish breeding'),
  ('Farmer Ibrahim', '9876543214', 'ibrahim@farm.com', 'Reservoir Road, Nellore', 'Nellore', 'Andhra Pradesh', '1234567894', 'ICICI Bank', 'Mixed varieties');

-- Sample Customers
INSERT INTO public.customers (name, phone, email, address, city, state, contact_person, business_type, notes) VALUES 
  ('Restaurant Al Nakheel', '9876543215', 'info@alnakheel.com', 'Main Street, Nellore', 'Nellore', 'Andhra Pradesh', 'Mohammad', 'Restaurant', 'Regular buyer, premium quality'),
  ('Market Central', '9876543216', 'sales@marketcentral.com', 'Market Complex, Nellore', 'Nellore', 'Andhra Pradesh', 'Rajesh', 'Wholesale Market', 'Bulk orders'),
  ('Fish Store Dubai', '9876543217', 'contact@fishstore.com', 'Dubai Market, Nellore', 'Nellore', 'Andhra Pradesh', 'Ahmed', 'Retail Store', 'Premium customer'),
  ('Hotel Emirates', '9876543218', 'procurement@emirates.com', 'Hotel Complex, Nellore', 'Nellore', 'Andhra Pradesh', 'Priya', 'Hotel/Restaurant', 'Daily deliveries'),
  ('Supermarket Al Reef', '9876543219', 'buying@alreef.com', 'Shopping Mall, Nellore', 'Nellore', 'Andhra Pradesh', 'Vikram', 'Supermarket', 'Consistent orders');

-- Sample Fish Varieties
INSERT INTO public.fish_varieties (name) VALUES 
  ('Tilapia Big'),
  ('Tilapia Small'),
  ('Tilapia Medium'),
  ('Catfish'),
  ('Pangasius Big'),
  ('Pangasius Small'),
  ('Pangasius Medium'),
  ('Roopchand Big'),
  ('Roopchand Small'),
  ('Roopchand Medium'),
  ('Katla Big'),
  ('Katla Small'),
  ('Katla Medium'),
  ('Rohu Big'),
  ('Rohu Small'),
  ('Rohu Medium'),
  ('Silver Carp Big'),
  ('Silver Carp Small'),
  ('Silver Carp Medium'),
  ('Grass Carp Big'),
  ('Grass Carp Small'),
  ('Grass Carp Medium');
