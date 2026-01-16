-- ============================================
-- Debug Billing Data
-- Run this to check the current state of bills and payments
-- ============================================

-- Check active bills per customer
SELECT
  c.name as customer_name,
  b.bill_number,
  b.bill_date,
  b.total,
  b.is_active,
  b.previous_balance,
  b.amount_paid,
  b.balance_due
FROM bills b
JOIN customers c ON c.id = b.customer_id
ORDER BY c.name, b.bill_date DESC;

-- Check all payments
SELECT

  c.name as customer_name,
  p.payment_date,
  p.amount,
  p.payment_method
FROM payments p
JOIN customers c ON c.id = p.customer_id
ORDER BY c.name, p.payment_date DESC;

-- Check which bills are marked as active
SELECT
  c.name as customer_name,
  COUNT(*) as active_bills_count
FROM bills b
JOIN customers c ON c.id = b.customer_id
WHERE b.is_active = true
GROUP BY c.name;

-- Check for customers with multiple active bills (should be 0)
SELECT
  c.name as customer_name,
  COUNT(*) as active_bills_count
FROM bills b
JOIN customers c ON c.id = b.customer_id
WHERE b.is_active = true
GROUP BY c.name
HAVING COUNT(*) > 1;
