DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_row
    WHERE constraint_row.conrelid = 'working.forecast_import_batches'::regclass
      AND constraint_row.conname = 'forecast_import_batches_source_window_key'
  ) THEN
    RAISE EXCEPTION 'Forecast import batch idempotency constraint is missing';
  END IF;
END;
$$;
