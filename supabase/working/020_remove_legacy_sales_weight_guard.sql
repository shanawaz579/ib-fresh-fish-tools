-- Remove the pre-catalog rule that required kilograms on every sale.

ALTER TABLE working.sales
  DROP CONSTRAINT IF EXISTS sales_actual_weight_positive;
