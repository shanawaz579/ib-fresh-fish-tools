# Payment System Migration Guide

## Overview
This guide will help you add the comprehensive payment tracking system to your fish wholesale billing application.

## What This Migration Adds

### 1. **Payment Tracking**
- Record payments from customers
- Track payment methods (Cash, Bank Transfer, UPI, Cheque)
- Auto-allocate payments to bills (oldest first)

### 2. **Bill Payment Status**
- Bills now have status: `unpaid`, `partial`, or `paid`
- Automatic balance tracking per bill
- View customer outstanding balance

### 3. **Other Charges**
- Add packing, ice, transport, loading charges to bills
- Flexible charge types

### 4. **Customer Ledger**
- Complete transaction history per customer
- Running balance calculation
- Account statement view

---

## Step-by-Step Migration Instructions

### Step 1: Backup Your Database
⚠️ **CRITICAL**: Before running any migration, backup your database!

```sql
-- If using pg_dump
pg_dump your_database_name > backup_$(date +%Y%m%d).sql
```

Or use Supabase dashboard: Database → Backup → Create Backup

---

### Step 2: Run the Migration SQL

**Option A: Using Supabase Dashboard (Recommended)**

1. Go to your Supabase project
2. Click "SQL Editor" in the left sidebar
3. Click "New Query"
4. Open the file: `supabase/migrations/20250101_add_payment_system.sql`
5. Copy the entire content
6. Paste into the Supabase SQL Editor
7. Click "Run" button

**Option B: Using psql Command Line**

```bash
psql your_database_connection_string < supabase/migrations/20250101_add_payment_system.sql
```

**Option C: Using Supabase CLI**

```bash
supabase db push
```

---

### Step 3: Verify Migration Success

Run these queries to verify the migration:

```sql
-- Check if new columns were added to bills table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'bills'
AND column_name IN ('amount_paid', 'balance_due', 'status');

-- Should return 3 rows

-- Check if new tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('payments', 'payment_allocations', 'bill_other_charges');

-- Should return 3 rows

-- Check if existing bills were initialized
SELECT COUNT(*) as unpaid_bills
FROM bills
WHERE status = 'unpaid';

-- Should return count of your existing bills
```

---

### Step 4: Verify in Mobile App

1. Start your mobile app:
   ```bash
   cd mobile
   npm start
   ```

2. The app should continue working normally
3. All existing bills should now show as "Unpaid"
4. You can now use the new payment features

---

## What Changed in Your Database

### Modified Tables

#### `bills` table - NEW COLUMNS:
| Column | Type | Description |
|--------|------|-------------|
| `amount_paid` | DECIMAL | Total amount paid against this bill |
| `balance_due` | DECIMAL | Remaining amount to be paid |
| `status` | VARCHAR | Payment status: unpaid, partial, or paid |

### New Tables Created

#### `payments` table:
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `customer_id` | BIGINT | Foreign key to customers |
| `payment_date` | DATE | Date payment was received |
| `amount` | DECIMAL | Payment amount |
| `payment_method` | VARCHAR | cash, bank_transfer, upi, cheque, other |
| `reference_number` | VARCHAR | Transaction reference (optional) |
| `notes` | TEXT | Additional notes |

#### `payment_allocations` table:
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `payment_id` | BIGINT | Foreign key to payments |
| `bill_id` | BIGINT | Foreign key to bills |
| `allocated_amount` | DECIMAL | Amount allocated to this bill |

#### `bill_other_charges` table:
| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Primary key |
| `bill_id` | BIGINT | Foreign key to bills |
| `charge_type` | VARCHAR | packing, ice, transport, loading, unloading, other |
| `description` | VARCHAR | Charge description |
| `amount` | DECIMAL | Charge amount (can be positive or negative) |

---

## Automated Features (Database Triggers)

The migration automatically creates these triggers:

1. **Auto-Update Bill Status**: When a payment is allocated, the bill's `amount_paid`, `balance_due`, and `status` are automatically updated

2. **Timestamp Management**: Payments table has auto-updating timestamps

3. **Cascading Deletes**: If a payment is deleted, its allocations are also deleted

---

## Rollback Instructions (If Something Goes Wrong)

If you need to undo the migration:

```sql
-- Drop new tables
DROP TABLE IF EXISTS payment_allocations CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bill_other_charges CASCADE;

-- Remove new columns from bills
ALTER TABLE bills DROP COLUMN IF EXISTS amount_paid;
ALTER TABLE bills DROP COLUMN IF EXISTS balance_due;
ALTER TABLE bills DROP COLUMN IF EXISTS status;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS update_bill_on_allocation_insert ON payment_allocations;
DROP TRIGGER IF EXISTS update_bill_on_allocation_update ON payment_allocations;
DROP TRIGGER IF EXISTS update_bill_on_allocation_delete ON payment_allocations;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP FUNCTION IF EXISTS update_bill_payment_status();
DROP FUNCTION IF EXISTS update_bill_on_allocation_delete();
DROP FUNCTION IF EXISTS update_updated_at_column();
```

Then restore from your backup.

---

## Next Steps After Migration

### 1. Test the Bill Generation
- Create a new bill
- Add other charges (packing, ice, etc.)
- Verify calculations are correct

### 2. Test Payment Recording
- Record a payment against a bill
- Verify bill status updates automatically
- Check customer outstanding balance

### 3. Review Customer Accounts
- View customer ledger
- Verify transaction history
- Check running balances

---

## Troubleshooting

### Issue: Migration fails with "column already exists"
**Solution**: The columns might already exist. Check with:
```sql
\d bills
```
If columns exist, skip to Step 3 verification.

### Issue: Permission denied
**Solution**: Ensure you have SUPERUSER or table owner privileges.

### Issue: Trigger errors
**Solution**: Ensure PostgreSQL version is 10+ (Supabase uses 15+, so this should not be an issue).

---

## Support

If you encounter issues:
1. Check the error message carefully
2. Verify you're connected to the correct database
3. Ensure you have proper permissions
4. Check that all prerequisites are met

---

## Data Integrity Guarantees

✅ **Safe for Production**:
- All existing bills are preserved
- No data is deleted
- Only new columns/tables are added
- Existing bills are marked as "unpaid" (which they are)

✅ **Referential Integrity**:
- Foreign keys ensure data consistency
- Cascading deletes prevent orphaned records
- Check constraints validate data

✅ **Automatic Calculations**:
- Bill status is always consistent with payments
- Balance calculations are automatic
- No manual updates needed

---

## Performance Notes

### Indexes Created:
- Customer ID (bills and payments)
- Payment date
- Bill date
- Bill status
- Payment and allocation relationships

These indexes ensure fast queries even with thousands of records.

---

## Estimated Migration Time

- **Small Database** (< 1000 bills): < 1 second
- **Medium Database** (1000-10000 bills): 1-5 seconds
- **Large Database** (> 10000 bills): 5-30 seconds

The migration is designed to be fast and non-blocking.

---

## Success Checklist

After migration, verify:
- [ ] Migration SQL ran without errors
- [ ] All 3 new tables exist
- [ ] Bills table has 3 new columns
- [ ] All existing bills have status = 'unpaid'
- [ ] Mobile app starts without errors
- [ ] Can create new bills
- [ ] Can add other charges to bills
- [ ] Can view customer outstanding balance

---

**Ready to migrate? Follow Step 1: Backup Your Database!**
