-- Make legacy forecast staging repeatable without creating duplicate batches.

BEGIN;

ALTER TABLE working.forecast_import_batches
ADD CONSTRAINT forecast_import_batches_source_window_key
UNIQUE (source_system, source_start_date, source_end_date, cutover_date);

COMMIT;
