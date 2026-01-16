-- ============================================
-- Fix Multiple Active Bills Issue
-- This script ensures only the latest bill per customer is marked as active
-- ============================================

-- Step 1: Mark ALL bills as inactive first
UPDATE bills SET is_active = false;

-- Step 2: Mark only the latest bill per customer as active
WITH latest_bills AS (
  SELECT DISTINCT ON (customer_id)
    id,
    customer_id,
    bill_date,
    created_at
  FROM bills
  ORDER BY customer_id, bill_date DESC, created_at DESC, id DESC
)
UPDATE bills
SET is_active = true
WHERE id IN (SELECT id FROM latest_bills);

-- Step 3: Verify - show active bills per customer (should be 1 per customer)
SELECT
  c.name as customer_name,
  b.bill_number,
  b.bill_date,
  b.total,
  b.is_active
FROM bills b
JOIN customers c ON c.id = b.customer_id
WHERE b.is_active = true
ORDER BY c.name, b.bill_date DESC;

-- Step 4: Check for any customers with multiple active bills (should return 0 rows)
SELECT
  c.name as customer_name,
  COUNT(*) as active_bills_count
FROM bills b
JOIN customers c ON c.id = b.customer_id
WHERE b.is_active = true
GROUP BY c.name
HAVING COUNT(*) > 1;
