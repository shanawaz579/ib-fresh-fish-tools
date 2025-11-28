# Purchase Bills Database Setup

## Overview
This document provides instructions for setting up the purchase bills feature in the database.

## Database Tables

The purchase bills feature requires three new tables:

1. **purchase_bills** - Main table for purchase bills
2. **purchase_bill_items** - Line items for each bill
3. **purchase_bill_payments** - Payment tracking with date and mode

## Setup Instructions

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the contents of `/supabase/migrations/create_purchase_bills_tables.sql`
5. Click **Run** to execute the migration

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# From the project root directory
supabase db push
```

This will automatically apply all pending migrations.

## Table Schema Details

### purchase_bills
- `id` - Auto-incrementing primary key
- `bill_number` - Unique bill number (e.g., PB-0001)
- `farmer_id` - Foreign key to farmers table
- `bill_date` - Date of the bill
- `gross_amount` - Total before deductions
- `weight_deduction_percentage` - Weight deduction % (default 5%)
- `weight_deduction_amount` - Amount deducted for weight
- `subtotal` - Amount after weight deduction
- `commission_per_kg` - Commission rate per kg (e.g., ₹0.5/kg)
- `commission_amount` - Total commission (ADDED to bill)
- `other_deductions` - JSONB array of other deductions
- `other_deductions_total` - Sum of other deductions
- `total` - Final amount (subtotal + commission - other deductions)
- `payment_status` - 'pending', 'partial', or 'paid'
- `amount_paid` - Total amount paid so far
- `balance_due` - Remaining balance
- `notes` - Optional notes
- `created_at` - Timestamp

### purchase_bill_items
- `id` - Auto-incrementing primary key
- `purchase_bill_id` - Foreign key to purchase_bills
- `fish_variety_id` - Foreign key to fish_varieties
- `fish_variety_name` - Name of fish variety
- `quantity_crates` - Number of crates
- `quantity_kg` - Loose quantity in kg
- `actual_weight` - Total actual weight
- `billable_weight` - Weight after deduction (e.g., 95% of actual)
- `rate_per_kg` - Rate per kilogram
- `amount` - Item total (billable_weight × rate_per_kg)
- `created_at` - Timestamp

### purchase_bill_payments
- `id` - Auto-incrementing primary key
- `purchase_bill_id` - Foreign key to purchase_bills
- `payment_date` - Date of payment
- `amount` - Payment amount
- `payment_mode` - 'cash', 'upi', 'neft', or 'other'
- `notes` - Optional payment notes
- `created_at` - Timestamp

## Verification

After running the migration, verify the tables were created:

```sql
-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'purchase_%';
```

You should see:
- purchase_bills
- purchase_bill_items
- purchase_bill_payments

## Row Level Security (RLS)

If you have RLS enabled on your Supabase project, you may need to add policies:

```sql
-- Enable RLS on purchase bills tables
ALTER TABLE purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bill_payments ENABLE ROW LEVEL SECURITY;

-- Add policies (adjust based on your auth setup)
CREATE POLICY "Enable all access for authenticated users" ON purchase_bills
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON purchase_bill_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON purchase_bill_payments
  FOR ALL USING (auth.role() = 'authenticated');
```

## Features

### Commission Calculation
- Commission is **ADDED** to the bill (not subtracted)
- Calculated as: `total_billable_weight × commission_per_kg`
- Example: 1000kg × ₹0.5/kg = ₹500 (added to total)

### Weight Deduction
- Optional per-item deduction (default 5%)
- Can be toggled on/off for each item
- Reduces billable weight: `actual_weight × (1 - deduction%/100)`

### Payment Tracking
- Multiple payments can be added to a bill
- Each payment records: date, amount, mode (cash/upi/neft/other), and notes
- Payment status automatically updates:
  - **pending** - No payments (amount_paid = 0)
  - **partial** - Partial payment (0 < amount_paid < total)
  - **paid** - Fully paid (amount_paid >= total)

## Troubleshooting

### Error: "Could not find the table 'public.purchase_bills'"
- The migration hasn't been run yet
- Follow the setup instructions above

### Error: "relation does not exist"
- Make sure you're connected to the correct Supabase project
- Verify the migration was executed successfully

### Error: "permission denied"
- Check your RLS policies
- Ensure your user has the necessary permissions
