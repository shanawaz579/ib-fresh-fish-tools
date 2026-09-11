DO $$
DECLARE
  target RECORD;
  maximum_id BIGINT;
  sequence_value BIGINT;
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

    EXECUTE format('SELECT last_value FROM %s', target.sequence_name)
      INTO sequence_value;

    IF sequence_value < GREATEST(maximum_id, 1) THEN
      RAISE EXCEPTION 'Sequence % is behind working.%.%',
        target.sequence_name, target.table_name, target.column_name;
    END IF;
  END LOOP;
END;
$$;

SELECT 'generated ID sequences verified' AS result;
