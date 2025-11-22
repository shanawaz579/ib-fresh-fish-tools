-- Create expense_categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50) DEFAULT 'more',
  color VARCHAR(20) DEFAULT '#6b7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  payment_method VARCHAR(50),
  paid_to VARCHAR(200),
  expense_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date_category ON expenses(expense_date, category_id);

-- Insert default expense categories
INSERT INTO expense_categories (name, icon, color) VALUES
  ('Fuel/Transport', 'truck', '#f59e0b'),
  ('Labor/Wages', 'users', '#3b82f6'),
  ('Ice/Cold Storage', 'snowflake', '#06b6d4'),
  ('Packaging', 'package', '#8b5cf6'),
  ('Vehicle Maintenance', 'wrench', '#ef4444'),
  ('Commission/Fees', 'percent', '#10b981'),
  ('Food/Refreshments', 'coffee', '#f97316'),
  ('Miscellaneous', 'more', '#6b7280')
ON CONFLICT DO NOTHING;
