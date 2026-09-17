-- Same-name customers are allowed only when both have explicit, different locations.
-- This prevents a blank-location duplicate from splitting bills and payments.

CREATE OR REPLACE FUNCTION working.prevent_ambiguous_customer_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = working, pg_temp
AS $$
DECLARE
  normalized_name TEXT;
  normalized_location TEXT;
BEGIN
  IF NOT NEW.is_active THEN RETURN NEW; END IF;

  normalized_name := lower(regexp_replace(btrim(NEW.name), '[[:space:]]+', ' ', 'g'));
  normalized_location := lower(regexp_replace(
    btrim(coalesce(nullif(NEW.city, ''), nullif(NEW.address, ''), '')),
    '[[:space:]]+', ' ', 'g'
  ));

  IF EXISTS (
    SELECT 1
    FROM working.customers existing
    WHERE existing.id IS DISTINCT FROM NEW.id
      AND existing.is_active
      AND lower(regexp_replace(btrim(existing.name), '[[:space:]]+', ' ', 'g')) = normalized_name
      AND (
        normalized_location = ''
        OR lower(regexp_replace(
          btrim(coalesce(nullif(existing.city, ''), nullif(existing.address, ''), '')),
          '[[:space:]]+', ' ', 'g'
        )) = ''
      )
  ) THEN
    RAISE EXCEPTION 'A customer named % already exists. Add a location to distinguish the customer or use the existing account.', NEW.name
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_ambiguous_customer_duplicate ON working.customers;
CREATE TRIGGER prevent_ambiguous_customer_duplicate
BEFORE INSERT OR UPDATE OF name, city, address, is_active
ON working.customers
FOR EACH ROW
EXECUTE FUNCTION working.prevent_ambiguous_customer_duplicate();

COMMENT ON FUNCTION working.prevent_ambiguous_customer_duplicate() IS
  'Prevents active same-name customers when either record lacks a location; explicit different locations remain valid.';
