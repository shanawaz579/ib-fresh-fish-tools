-- ============================================
-- Delete All Bills and Payments
-- WARNING: This will permanently delete all bills and payments
-- ============================================

-- IMPORTANT: Make sure you have a backup before running this!

-- Step 1: Delete all payments (no foreign key dependencies)
DELETE FROM payments;

-- Step 2: Delete all bill other charges
DELETE FROM bill_other_charges;

-- Step 3: Delete all bill items
DELETE FROM bill_items;

-- Step 4: Delete all bills
DELETE FROM bills;

-- Step 5: Reset the sequence (optional - makes next bill start from IB-0001 again)
-- Only run this if you want to reset the bill number sequence
ALTER SEQUENCE bills_id_seq RESTART WITH 1;

-- Verification: Check that all data is deleted
SELECT COUNT(*) as remaining_bills FROM bills;
SELECT COUNT(*) as remaining_bill_items FROM bill_items;
SELECT COUNT(*) as remaining_bill_charges FROM bill_other_charges;
SELECT COUNT(*) as remaining_payments FROM payments;

-- Expected result: All counts should be 0
