#!/usr/bin/env bash
set -euo pipefail

: "${PRODUCTION_DATABASE_URL:?Set PRODUCTION_DATABASE_URL before verification}"

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
npx supabase db query --db-url "$PRODUCTION_DATABASE_URL" \
  --file "$repo_dir/supabase/production/verify.sql"
