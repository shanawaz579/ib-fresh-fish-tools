-- Read-only production inventory. This returns counts, never business row contents.
SELECT table_schema, count(*) AS table_count
FROM information_schema.tables
WHERE table_type = 'BASE TABLE' AND table_schema IN ('public', 'working')
GROUP BY table_schema
ORDER BY table_schema;

SELECT relname AS table_name, n_live_tup::BIGINT AS estimated_rows
FROM pg_stat_user_tables
WHERE schemaname = 'working'
ORDER BY relname;

SELECT coalesce(raw_app_meta_data ->> 'role', 'missing') AS app_role, count(*) AS user_count
FROM auth.users
GROUP BY 1
ORDER BY 1;

SELECT tablename
FROM pg_tables table_row
WHERE schemaname = 'working'
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies policy_row
    WHERE policy_row.schemaname = table_row.schemaname
      AND policy_row.tablename = table_row.tablename
  )
ORDER BY tablename;
