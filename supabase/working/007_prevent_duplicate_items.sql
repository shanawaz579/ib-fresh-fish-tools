-- Prevent duplicate catalog items in the isolated working schema.
-- Names are compared after trimming, collapsing whitespace and ignoring case.

DO $$
DECLARE
  duplicate_names TEXT;
BEGIN
  SELECT string_agg(normalized_name, ', ' ORDER BY normalized_name)
  INTO duplicate_names
  FROM (
    SELECT lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')) AS normalized_name
    FROM working.items
    GROUP BY lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_names IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot install duplicate-item protection until these duplicate names are resolved: %',
      duplicate_names;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS items_normalized_name_key
  ON working.items (
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g'))
  );

CREATE OR REPLACE FUNCTION working.normalize_catalog_item_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = working
AS $$
BEGIN
  NEW.name := regexp_replace(btrim(NEW.name), '[[:space:]]+', ' ', 'g');

  IF NEW.name = '' THEN
    RAISE EXCEPTION 'Item name is required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_catalog_item_name ON working.items;
CREATE TRIGGER normalize_catalog_item_name
BEFORE INSERT OR UPDATE OF name ON working.items
FOR EACH ROW
EXECUTE FUNCTION working.normalize_catalog_item_name();

REVOKE ALL ON FUNCTION working.normalize_catalog_item_name() FROM PUBLIC;
