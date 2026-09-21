-- Preserve grade-unknown legacy demand at item-family level instead of forcing a grade.

BEGIN;

ALTER TABLE working.forecast_item_mappings
ADD COLUMN item_id BIGINT REFERENCES working.items(id) ON DELETE RESTRICT;

ALTER TABLE working.forecast_item_mappings
ADD CONSTRAINT forecast_item_mappings_single_target
CHECK (item_id IS NULL OR item_variant_id IS NULL);

CREATE INDEX idx_forecast_item_mapping_item
  ON working.forecast_item_mappings(item_id)
  WHERE item_id IS NOT NULL;

CREATE OR REPLACE VIEW working.forecast_training_sales
WITH (security_invoker = TRUE)
AS
SELECT
  history.sale_date,
  customer_mapping.customer_id,
  item_mapping.item_variant_id,
  history.quantity_crates,
  'legacy'::TEXT AS source_system,
  history.legacy_sale_id::TEXT AS source_sale_id,
  coalesce(item_mapping.item_id, mapped_variant.item_id) AS item_id,
  CASE WHEN item_mapping.item_id IS NOT NULL THEN 'item' ELSE 'variant' END::TEXT AS mapping_level
FROM working.forecast_sales_history history
JOIN working.forecast_import_batches batch
  ON batch.id = history.import_batch_id
JOIN working.forecast_item_mappings item_mapping
  ON item_mapping.source_system = history.source_system
 AND item_mapping.legacy_item_id = history.legacy_item_id
 AND item_mapping.match_status = 'confirmed'
LEFT JOIN working.item_variants mapped_variant
  ON mapped_variant.id = item_mapping.item_variant_id
LEFT JOIN working.forecast_customer_mappings customer_mapping
  ON customer_mapping.source_system = history.source_system
 AND customer_mapping.legacy_customer_id = history.legacy_customer_id
 AND customer_mapping.match_status = 'confirmed'
WHERE batch.status IN ('validated', 'imported')
  AND history.sale_date < batch.cutover_date
  AND history.quantity_crates > 0

UNION ALL

SELECT
  sale.sale_date,
  sale.customer_id,
  sale.fish_variety_id AS item_variant_id,
  sale.quantity_crates,
  'current'::TEXT AS source_system,
  sale.id::TEXT AS source_sale_id,
  current_variant.item_id,
  'variant'::TEXT AS mapping_level
FROM working.sales sale
JOIN working.item_variants current_variant
  ON current_variant.id = sale.fish_variety_id
WHERE sale.quantity_crates > 0;

COMMENT ON VIEW working.forecast_training_sales IS
  'Crate-only training rows. Grade-unknown legacy demand remains at item level for later allocation using the current grade mix.';

COMMIT;
