# Sales Billing Status Tracking - Implementation Guide

## Overview
The sales billing status system ensures that all sales entries are properly tracked and billed, preventing any sales from being missed in the billing process.

## Features Implemented

### 1. **Billing Status Field**
Every sale now has a `billing_status` field with three possible values:
- `unbilled` - Sale has not been included in any bill (default)
- `billed` - Sale has been included in a bill
- `partial` - Sale is partially billed (for future use)

### 2. **Bill Reference**
Each sale has a `billed_in_bill_id` field that references which bill includes this sale.

### 3. **Automatic Status Updates**
Database triggers automatically update the billing status when:
- ✅ A bill is created → Matching sales marked as 'billed'
- ✅ A bill is modified → Sales status updated accordingly
- ✅ A bill is deleted → Sales reset to 'unbilled'

### 4. **Visual Indicators in Mobile App**
The SalesScreen now shows color-coded badges:
- 🟢 **✓ Billed** (Green badge) - Sale is included in a bill
- 🔴 **⚠ Not Billed** (Red badge) - Sale needs to be billed
- 🟡 **◐ Partial** (Yellow badge) - Sale is partially billed

## How It Works

### Workflow:

1. **Create Sales Entry**
   ```
   Sales Entry → Status: "unbilled"
   Display: Red badge "⚠ Not Billed"
   ```

2. **Generate Bill**
   ```
   Bill Creation → Trigger matches sales by:
   - Customer ID
   - Date (sale_date = bill_date)
   - Fish variety
   - Quantity (crates + kg)

   Matched Sales → Status: "billed", billed_in_bill_id: [bill_id]
   Display: Green badge "✓ Billed"
   ```

3. **Delete Bill**
   ```
   Bill Deletion → Trigger resets all sales in that bill

   Sales → Status: "unbilled", billed_in_bill_id: NULL
   Display: Red badge "⚠ Not Billed"
   ```

## Database Schema

### Sales Table Columns Added:
```sql
billing_status VARCHAR(20) DEFAULT 'unbilled'
  CHECK (billing_status IN ('unbilled', 'billed', 'partial'))

billed_in_bill_id INTEGER REFERENCES bills(id) ON DELETE SET NULL
```

### Indexes Created:
```sql
idx_sales_billing_status ON sales(billing_status)
idx_sales_billed_in_bill_id ON sales(billed_in_bill_id)
```

## Triggers

### 1. `trigger_update_sales_billing_status`
- Fires on INSERT, UPDATE, DELETE of `bill_items`
- Updates matching sales to 'billed' status
- Resets sales no longer in bill to 'unbilled'

### 2. `trigger_handle_bill_deletion`
- Fires BEFORE DELETE on `bills`
- Resets all sales in that bill to 'unbilled'

## Testing the System

### Test Case 1: Create Sale and Bill
1. Go to Sales Entry screen
2. Add a sale for a customer (e.g., 5 crates of Pangasius)
3. Check status → Should show "⚠ Not Billed"
4. Go to Bill Generation
5. Generate a bill including that sale
6. Return to Sales Entry screen
7. Check status → Should now show "✓ Billed"

### Test Case 2: Delete Bill
1. Find a sale marked as "✓ Billed"
2. Delete the associated bill
3. Return to Sales Entry screen
4. Check status → Should now show "⚠ Not Billed"

### Test Case 3: Partial Bill
1. Create 3 sales for same customer on same date
2. Create a bill with only 2 of those sales
3. Check sales screen:
   - 2 sales → "✓ Billed"
   - 1 sale → "⚠ Not Billed"

## Queries for Monitoring

### Find all unbilled sales:
```sql
SELECT s.*, c.name as customer_name, fv.name as fish_variety_name
FROM sales s
JOIN customers c ON s.customer_id = c.id
JOIN fish_varieties fv ON s.fish_variety_id = fv.id
WHERE s.billing_status = 'unbilled'
ORDER BY s.sale_date DESC;
```

### Find sales by bill:
```sql
SELECT s.*, c.name as customer_name, fv.name as fish_variety_name
FROM sales s
JOIN customers c ON s.customer_id = c.id
JOIN fish_varieties fv ON s.fish_variety_id = fv.id
WHERE s.billed_in_bill_id = [BILL_ID];
```

### Count unbilled sales by customer:
```sql
SELECT c.name, COUNT(*) as unbilled_count
FROM sales s
JOIN customers c ON s.customer_id = c.id
WHERE s.billing_status = 'unbilled'
GROUP BY c.name
ORDER BY unbilled_count DESC;
```

## Migration Files

1. **20250116_add_billing_status_to_sales.sql**
   - Adds billing_status and billed_in_bill_id columns
   - Creates indexes and constraints
   - Updates existing sales to 'unbilled'

2. **20250116_add_sales_bill_trigger.sql**
   - Creates trigger function to update sales status
   - Handles bill creation, modification, and deletion
   - Ensures data consistency

## Benefits

✅ **No Sales Missed** - Clear visibility of unbilled sales
✅ **Automatic Tracking** - No manual status updates needed
✅ **Data Integrity** - Database triggers ensure consistency
✅ **Easy Reporting** - Quick queries to find unbilled sales
✅ **Visual Feedback** - Color-coded badges in mobile app
✅ **Audit Trail** - Know which bill includes each sale

## Future Enhancements

- Dashboard widget showing unbilled sales count
- Push notifications for unbilled sales older than X days
- Bulk bill generation for all unbilled sales
- Export unbilled sales report
- Partial billing support for split deliveries

## Support

For issues or questions:
1. Check the mobile app console for any errors
2. Verify triggers are active: `SELECT * FROM information_schema.triggers WHERE trigger_name LIKE '%sales%';`
3. Check sales data: `SELECT DISTINCT billing_status FROM sales;`
