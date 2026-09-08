#!/usr/bin/env bash
set -euo pipefail

: "${PRODUCTION_DATABASE_URL:?Set PRODUCTION_DATABASE_URL before deployment}"

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
migration_dir="$repo_dir/supabase/working"

table_count="$(npx supabase db query --db-url "$PRODUCTION_DATABASE_URL" --output csv \
  "select count(*) from information_schema.tables where table_schema='working' and table_type='BASE TABLE'" \
  2>/dev/null | tail -n 1 | tr -d '[:space:]')"

if [[ "$table_count" != "0" ]]; then
  echo "Refusing fresh deployment: working already contains $table_count tables." >&2
  exit 1
fi

for migration in "$migration_dir"/[0-9][0-9][0-9]_*.sql; do
  [[ "$(basename "$migration")" == "1000_clean_up.sql" ]] && continue
  echo "Applying $(basename "$migration")"
  npx supabase db query --db-url "$PRODUCTION_DATABASE_URL" --file "$migration"
done

echo "Fresh production schema deployed. Run verify.sh next."
