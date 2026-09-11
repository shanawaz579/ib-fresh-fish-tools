BEGIN;

-- Production master data was imported with explicit IDs. Advance every serial
-- or identity sequence to its table's current maximum so future inserts cannot
-- collide with imported records.
DO $$
DECLARE
  target RECORD;
  maximum_id BIGINT;
BEGIN
  FOR target IN
    SELECT columns.table_name,
           columns.column_name,
           pg_get_serial_sequence(
             format('%I.%I', columns.table_schema, columns.table_name),
             columns.column_name
           ) AS sequence_name
      FROM information_schema.columns columns
     WHERE columns.table_schema = 'working'
       AND pg_get_serial_sequence(
             format('%I.%I', columns.table_schema, columns.table_name),
             columns.column_name
           ) IS NOT NULL
  LOOP
    EXECUTE format(
      'SELECT COALESCE(MAX(%I), 0) FROM working.%I',
      target.column_name,
      target.table_name
    ) INTO maximum_id;

    PERFORM setval(
      target.sequence_name::regclass,
      GREATEST(maximum_id, 1),
      maximum_id > 0
    );
  END LOOP;
END;
$$;

COMMIT;
