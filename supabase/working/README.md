# Working database schema

This directory defines an isolated development schema for the mobile app. It does not contain a migration that targets `public`, and it does not copy production data.

## Recommended environment

Use a separate Supabase development project. Creating `working` inside the production project would still modify the production database's schema metadata, even though its tables and data are isolated.

Apply these files manually, in order, only to the development project:

1. `001_tables.sql`
2. `002_security.sql`
3. `003_customer_billing.sql`
4. `004_purchase_billing.sql`
5. `005_item_catalog.sql`
6. `006_item_code_guard.sql`
7. `007_prevent_duplicate_items.sql`
8. `008_mediator_farmer_purchases.sql`
9. `009_free_text_farmer_purchase_batch.sql`
10. `010_mediator_location.sql`
11. `011_unified_purchase_suppliers.sql`
12. `012_purchase_crates_and_loose_kg.sql`
13. `013_purchase_group_edit.sql`
14. `014_purchase_bill_weight_commission.sql`
15. `015_direct_farmer_optional_commission.sql`
16. `016_auditable_purchase_payments.sql`
17. `017_stock_ledger.sql`
18. `018_stock_ledger_permissions.sql`
19. `019_sales_crates_or_kg.sql`
20. `020_remove_legacy_sales_weight_guard.sql`
21. `021_auditable_customer_payments.sql`
22. `022_guarded_customer_bill_deletion.sql`
23. `023_guarded_purchase_bill_deletion.sql`
24. `024_business_configuration.sql`
25. `025_purchase_bill_config_defaults.sql`
26. `026_auditable_expenses.sql`
27. `027_expense_reference_required.sql`
28. `028_expense_reference_optional.sql`
29. `029_optional_payment_references.sql`
30. `030_auditable_cashbook.sql`
31. `031_prevent_negative_cash_closing.sql`
32. `032_weighted_average_profitability.sql`
33. `033_incremental_costing_refresh.sql`
34. `034_lock_private_costing_functions.sql`
35. `035_harden_costing_state_updates.sql`
36. `036_production_day_lock.sql`

Then add `working` to the development project's **API Settings → Exposed schemas**. Do not expose it in the production project.

Configure the mobile app with the development project's URL and anon key:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-development-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-development-anon-key
EXPO_PUBLIC_SUPABASE_SCHEMA=working
```

The schema starts empty. Add only synthetic test records; do not import live customer, farmer, payment, or billing data.

## Tables

| Area | Tables |
|---|---|
| Configuration | `business_profile`, `business_preferences` |
| Catalog | `units`, `item_grades`, `items`, `item_variants` |
| Parties | `suppliers`, `farmers`, `customers` |
| Operations | `purchases`, `sales`, `packing_status`, `stock_locations`, `stock_movements` |
| Expenses | `expense_categories`, `expenses` |
| Cashbook & day lock | `cash_adjustments`, `cash_day_closings`, `cashbook_entries` view, readiness RPC, transaction lock triggers |
| Costing | `inventory_costing_runs`, `inventory_cost_events`, costing source views |
| Customer billing | `bills`, `bill_items`, `bill_item_sales`, `bill_other_charges`, `payments` |
| Supplier billing | `purchase_bills`, `purchase_bill_items`, `purchase_bill_payments` |

The working design uses a single-trader configuration record rather than shared multi-tenancy. Each trader deployment gets its own Supabase project/schema and can configure branding, terminology, currency, units, commissions, deduction defaults, and enabled modules. Suppliers are the primary payable accounts and may be mediators or directly paid farmers; farmers also identify the physical source. `item_variants` holds selectable item-and-grade combinations such as `Pangasius - S`. A purchase can contain crates, loose kilograms, or both; total purchase weight is the item’s configured kg-per-crate multiplied by crates, plus loose kilograms. `stock_movements` is the immutable source of inventory truth, automatically linked to purchases and sales. `bill_item_sales` identifies exactly which sales were included in each customer bill item.

## Access model

- `admin`: full access and billing RPC execution.
- `packer`: reads customer/order data and inserts or updates packing status.
- `viewer`: reads only dashboard operational data.

Set roles in Supabase Auth under `app_metadata.role`. Temporary legacy email mappings remain only to keep the existing development accounts usable during the transition.
