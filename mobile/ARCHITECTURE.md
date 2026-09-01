# Mobile architecture

The mobile application is an Expo/React Native client backed directly by Supabase.

## Source boundaries

- `src/screens`: navigation-level UI and workflow orchestration only.
- `src/components`: reusable presentation components.
- `src/domain`: business types and pure fish/billing grouping rules.
- `src/hooks`: reusable React state behavior.
- `src/api`: Supabase persistence split into master data, inventory, customer accounts, customer bills, and purchase bills. Screens should not query Supabase directly.
- `src/features`: feature-specific hooks, previews, share text, and print templates.
- `src/styles`: screen styles split into focused form/list/preview modules.
- `src/auth`: role resolution. New accounts should use `app_metadata.role`.
- `src/config`: validated runtime configuration.
- `src/utils`: infrastructure-neutral helpers such as date-only handling.

## Business invariants

- Business dates are local calendar dates (`YYYY-MM-DD`), never UTC timestamps.
- Crate weight is stored on every customer bill line so historical bills remain reproducible.
- Only one customer bill should be active per customer.
- A bill total rolls forward the previous active balance and payments received since that bill.
- Purchase and sales batch screens must treat any failed row as a failed operation.

## Scaling roadmap

1. Move multi-table bill creation into transactional Supabase RPC functions.
2. Replace legacy email role mapping with Auth `app_metadata.role` and enforce matching RLS policies.
3. Add unit tests for `src/domain` and integration tests against a local Supabase instance.
4. Introduce a query/cache layer for retry, refresh, optimistic updates, and offline behavior.
