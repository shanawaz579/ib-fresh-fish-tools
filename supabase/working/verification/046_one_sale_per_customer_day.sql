DO $$
BEGIN
  IF position(
    'A sale already exists for this customer on this date'
    IN pg_get_functiondef('working.save_sales_batch(bigint,date,jsonb)'::regprocedure)
  ) = 0 THEN
    RAISE EXCEPTION 'One-sale-per-customer-day guard is missing';
  END IF;
END;
$$;
