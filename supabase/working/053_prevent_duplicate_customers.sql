BEGIN;

-- Customer identity is name + location. The same name remains valid in a
-- different city, while phone and email identify a customer globally when set.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM working.customers
    GROUP BY
      lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')),
      lower(regexp_replace(btrim(coalesce(nullif(city, ''), nullif(address, ''), '')), '[[:space:]]+', ' ', 'g')),
      lower(regexp_replace(btrim(coalesce(state, '')), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate customer name and location records before applying migration 053';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM working.customers
    WHERE nullif(regexp_replace(phone, '[^0-9]', '', 'g'), '') IS NOT NULL
    GROUP BY regexp_replace(phone, '[^0-9]', '', 'g')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate customer phone numbers before applying migration 053';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM working.customers
    WHERE nullif(btrim(email), '') IS NOT NULL
    GROUP BY lower(btrim(email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate customer email addresses before applying migration 053';
  END IF;
END;
$$;

CREATE UNIQUE INDEX customers_normalized_identity_key
  ON working.customers (
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')),
    lower(regexp_replace(btrim(coalesce(nullif(city, ''), nullif(address, ''), '')), '[[:space:]]+', ' ', 'g')),
    lower(regexp_replace(btrim(coalesce(state, '')), '[[:space:]]+', ' ', 'g'))
  );

CREATE UNIQUE INDEX customers_normalized_phone_key
  ON working.customers (regexp_replace(phone, '[^0-9]', '', 'g'))
  WHERE nullif(regexp_replace(phone, '[^0-9]', '', 'g'), '') IS NOT NULL;

CREATE UNIQUE INDEX customers_normalized_email_key
  ON working.customers (lower(btrim(email)))
  WHERE nullif(btrim(email), '') IS NOT NULL;

COMMIT;
