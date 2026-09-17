DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'prevent_ambiguous_customer_duplicate'
      AND tgrelid = 'working.customers'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Ambiguous customer duplicate trigger is missing';
  END IF;
END;
$$;
