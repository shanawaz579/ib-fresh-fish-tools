-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  received_from VARCHAR(200),
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
  reference_number VARCHAR(100),
  notes TEXT,
  payment_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date_method ON payments(payment_date, payment_method);
