-- Create purchase_bills table
CREATE TABLE IF NOT EXISTS purchase_bills (
  id SERIAL PRIMARY KEY,
  bill_number VARCHAR(20) NOT NULL UNIQUE,
  farmer_id INTEGER NOT NULL REFERENCES farmers(id) ON DELETE RESTRICT,
  bill_date DATE NOT NULL,
  gross_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  weight_deduction_percentage DECIMAL(5, 2) NOT NULL DEFAULT 5,
  weight_deduction_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  commission_per_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  commission_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  other_deductions JSONB DEFAULT '[]',
  other_deductions_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
  balance_due DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_bill_items table
CREATE TABLE IF NOT EXISTS purchase_bill_items (
  id SERIAL PRIMARY KEY,
  purchase_bill_id INTEGER NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  fish_variety_id INTEGER NOT NULL REFERENCES fish_varieties(id) ON DELETE RESTRICT,
  fish_variety_name VARCHAR(100) NOT NULL,
  quantity_crates DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantity_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  actual_weight DECIMAL(10, 2) NOT NULL DEFAULT 0,
  billable_weight DECIMAL(10, 2) NOT NULL DEFAULT 0,
  rate_per_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create purchase_bill_payments table
CREATE TABLE IF NOT EXISTS purchase_bill_payments (
  id SERIAL PRIMARY KEY,
  purchase_bill_id INTEGER NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_mode VARCHAR(20) NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_purchase_bills_date ON purchase_bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_farmer ON purchase_bills(farmer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_number ON purchase_bills(bill_number);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_status ON purchase_bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_bill ON purchase_bill_items(purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_variety ON purchase_bill_items(fish_variety_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_payments_bill ON purchase_bill_payments(purchase_bill_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_payments_date ON purchase_bill_payments(payment_date);

-- Add comments for documentation
COMMENT ON TABLE purchase_bills IS 'Purchase bills for farmers';
COMMENT ON COLUMN purchase_bills.gross_amount IS 'Total amount before any deductions';
COMMENT ON COLUMN purchase_bills.weight_deduction_percentage IS 'Percentage of weight deducted (typically 5%)';
COMMENT ON COLUMN purchase_bills.weight_deduction_amount IS 'Amount deducted due to weight reduction';
COMMENT ON COLUMN purchase_bills.subtotal IS 'Amount after weight deduction';
COMMENT ON COLUMN purchase_bills.commission_per_kg IS 'Commission rate per kg (e.g., ₹0.5/kg)';
COMMENT ON COLUMN purchase_bills.commission_amount IS 'Total commission amount (ADDED to bill)';
COMMENT ON COLUMN purchase_bills.other_deductions IS 'JSON array of other deductions like ice, transport';
COMMENT ON COLUMN purchase_bills.total IS 'Final total amount (subtotal + commission - other deductions)';

COMMENT ON TABLE purchase_bill_items IS 'Line items for each purchase bill';
COMMENT ON COLUMN purchase_bill_items.actual_weight IS 'Actual weight received';
COMMENT ON COLUMN purchase_bill_items.billable_weight IS 'Weight after applying deduction (e.g., 95% of actual)';

COMMENT ON TABLE purchase_bill_payments IS 'Payment tracking for purchase bills';
COMMENT ON COLUMN purchase_bill_payments.payment_mode IS 'Payment method: cash, upi, neft, or other';
