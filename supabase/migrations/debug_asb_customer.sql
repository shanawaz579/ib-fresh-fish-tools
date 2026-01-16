-- ============================================
-- Debug ASB Customer Outstanding Issue
-- ============================================

-- Check customer ID for ASB
SELECT id, name FROM customers WHERE name LIKE '%ASB%';

-- Check all bills for ASB (replace customer_id with actual ID from above)
SELECT
  b.id,
  b.bill_number,
  b.bill_date,
  b.total,
  b.status,
  b.is_active,
  b.previous_balance,
  b.amount_paid,
  b.balance_due
FROM bills b
JOIN customers c ON c.id = b.customer_id
WHERE c.name LIKE '%ASB%'
ORDER BY b.bill_date DESC;

-- Check all payments for ASB
SELECT
  p.id,
  p.payment_date,
  p.amount,
  p.payment_method
FROM payments p
JOIN customers c ON c.id = p.customer_id
WHERE c.name LIKE '%ASB%'
ORDER BY p.payment_date DESC;

-- Check what getCustomerOutstanding would return for ASB
SELECT
  c.name as customer_name,
  b.total,
  b.bill_date,
  b.status,
  b.is_active
FROM bills b
JOIN customers c ON c.id = b.customer_id
WHERE c.name LIKE '%ASB%'
  AND b.status = 'unpaid'
  AND b.is_active = true
ORDER BY b.bill_date ASC;
