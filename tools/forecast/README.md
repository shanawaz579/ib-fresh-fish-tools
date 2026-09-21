# Forecast history staging

Historical demand is isolated from operational sales, stock, bills, balances, and cashbook data.

## Safe workflow

1. Run the read-only audit:

   ```sh
   node tools/forecast/audit-legacy-history.mjs
   ```

2. Prepare an idempotent private import file outside the repository:

   ```sh
   node tools/forecast/prepare-legacy-import.mjs --output /tmp/legacy-forecast-import.json
   ```

3. Generate reviewable, repeatable SQL chunks in the ignored private directory:

   ```sh
   node tools/forecast/generate-staging-sql.mjs \
     --input .local-forecast-import/legacy-forecast-import.json \
     --output-dir .local-forecast-import/sql
   ```

4. Apply migrations `063` and `064` only after taking a production backup.
5. Stage legacy customers and items as `proposed` mappings.
6. Confirm ambiguous mappings before validating an import batch.
7. Import rows idempotently using `(source_system, legacy_sale_id)`.
8. Train only from `working.forecast_training_sales`.

Loose kilograms remain in the audit history but are excluded from the crate-only training view. Unmatched customers may remain null in the training view, while unmatched items are excluded until reviewed.

The prepared JSON contains customer names. Keep it outside Git and delete it after the verified import.
