-- Mediator location is required for new payable purchase accounts.

ALTER TABLE working.mediators
  ADD COLUMN IF NOT EXISTS location VARCHAR(255);

UPDATE working.mediators
SET location = coalesce(
  nullif(btrim(location), ''),
  nullif(btrim(city), ''),
  nullif(btrim(address), ''),
  'Not specified'
)
WHERE location IS NULL OR btrim(location) = '';

ALTER TABLE working.mediators
  ALTER COLUMN location SET NOT NULL;

COMMENT ON COLUMN working.mediators.location IS
  'Required primary location used to identify the mediator account.';
