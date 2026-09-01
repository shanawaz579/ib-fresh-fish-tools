SELECT
  to_regclass('working.stock_movements') IS NOT NULL AS has_stock_movements,
  to_regclass('working.stock_locations') IS NOT NULL AS has_stock_locations,
  to_regprocedure('working.get_stock_snapshot(date)') IS NOT NULL AS has_snapshot_rpc,
  to_regprocedure('working.record_stock_adjustment(bigint,date,character varying,integer,numeric,text,text)') IS NOT NULL AS has_adjustment_rpc,
  to_regprocedure('working.reconcile_stock(bigint,date,integer,numeric,text,text)') IS NOT NULL AS has_reconciliation_rpc,
  to_regprocedure('working.save_sales_batch(bigint,date,jsonb)') IS NOT NULL AS has_sales_batch_rpc,
  to_regprocedure('working.update_sales_group(bigint,date,jsonb)') IS NOT NULL AS has_sales_edit_rpc,
  has_table_privilege('authenticated', 'working.stock_movements', 'INSERT') AS authenticated_can_insert_movement,
  (SELECT count(*) FROM working.purchases) AS purchases,
  (SELECT count(*) FROM working.stock_movements WHERE source_type = 'purchase' AND voided_at IS NULL) AS purchase_movements,
  (SELECT count(*) FROM working.sales) AS sales,
  (SELECT count(*) FROM working.stock_movements WHERE source_type = 'sale' AND voided_at IS NULL) AS sale_movements,
  (
    SELECT count(*) FROM (
      SELECT source_type, source_id
      FROM working.stock_movements
      WHERE source_type IN ('purchase', 'sale') AND voided_at IS NULL
      GROUP BY source_type, source_id
      HAVING count(*) > 1
    ) duplicates
  ) AS duplicate_active_sources,
  (
    SELECT count(*)
    FROM (
      SELECT item_variant_id
      FROM working.stock_movements
      WHERE voided_at IS NULL
      GROUP BY item_variant_id
      HAVING sum(crates_delta) < 0 OR sum(kg_delta) < 0
    ) negative
  ) AS negative_current_balances;
