#!/usr/bin/env bash
set -euo pipefail

: "${PRODUCTION_DATABASE_URL:?Set PRODUCTION_DATABASE_URL before backup}"

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
backup_dir="$repo_dir/.local-backups"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"

npx supabase db dump --db-url "$PRODUCTION_DATABASE_URL" \
  --file "$backup_dir/production-$timestamp.sql"

echo "Backup written under .local-backups (excluded from Git)."
