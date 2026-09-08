# Production database runbook

The application schema is `working`. Environment isolation comes from using a separate Supabase project; the schema name is intentionally unchanged so the reviewed migrations and RPC contracts remain identical.

## Safety rules

- Never run `supabase/working/1000_clean_up.sql` in production.
- Never run files under `supabase/migrations`; they are legacy utilities for the old prototype.
- Never deploy to a database that has not been backed up.
- Use `deploy_fresh.sh` only on a new project where the `working` schema has no tables.
- Store database URLs and passwords in the shell or EAS secrets, never in Git.

## Fresh production project

1. Create a Supabase project in the required region.
2. In API settings, expose `working` alongside `public` and `graphql_public`.
3. Set `PRODUCTION_DATABASE_URL` to its direct or session-pooler PostgreSQL URL.
4. Run `./supabase/production/backup.sh` once to verify connectivity and capture the empty baseline.
5. Run `./supabase/production/deploy_fresh.sh`.
6. Run `./supabase/production/verify.sh`.
7. Add user roles in `auth.users.raw_app_meta_data`: `admin`, `packer`, or `viewer`.
8. Configure EAS production variables for the new Supabase URL, anon key, and `EXPO_PUBLIC_SUPABASE_SCHEMA=working`.

## Existing project

Do not replay the migration chain against an existing populated schema. First run `preflight.sql`, take a backup, and generate a reviewed schema diff. Transaction cleanup or master-data transfer is a separate, explicitly approved operation.

## Migration policy after launch

Files `001` through `047` form the initial migration chain. Every later database change receives one new numbered migration and one non-destructive verification file.
