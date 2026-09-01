BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'working.purchase_bills'::regclass
      AND tgname = 'apply_business_configuration'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Purchase bill configuration trigger is missing';
  END IF;
END;
$$;

ROLLBACK;
