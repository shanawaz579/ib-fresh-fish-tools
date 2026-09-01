-- Access rules for the isolated working schema.

GRANT USAGE ON SCHEMA working TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA working TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA working TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA working
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA working
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

CREATE OR REPLACE FUNCTION working.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = working
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'anonymous'
    WHEN auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'packer', 'viewer')
      THEN auth.jwt() -> 'app_metadata' ->> 'role'
    -- Temporary compatibility while existing accounts move to app_metadata.
    WHEN auth.jwt() ->> 'email' = 'shanawaz579@gmail.com' THEN 'admin'
    WHEN auth.jwt() ->> 'email' = 'shanawaz_sk@yahoo.com' THEN 'packer'
    ELSE 'viewer'
  END;
$$;

REVOKE ALL ON FUNCTION working.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.current_app_role() TO authenticated;

DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'units', 'item_grades', 'items', 'item_variants',
    'farmers', 'customers', 'purchases', 'sales',
    'packing_status', 'bills', 'bill_items', 'bill_item_sales',
    'bill_other_charges', 'payments', 'purchase_bills',
    'purchase_bill_items', 'purchase_bill_payments'
  ] LOOP
    EXECUTE format('ALTER TABLE working.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY admin_access ON working.%I FOR ALL TO authenticated '
      'USING (working.current_app_role() = ''admin'') '
      'WITH CHECK (working.current_app_role() = ''admin'')',
      target_table
    );
  END LOOP;
END;
$$;

-- Viewer dashboard: stock, sales, catalog and customer names.
DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['units', 'item_grades', 'items', 'item_variants'] LOOP
    EXECUTE format(
      'CREATE POLICY viewer_read_catalog ON working.%I FOR SELECT TO authenticated '
      'USING (working.current_app_role() = ''viewer'')',
      target_table
    );
  END LOOP;
END;
$$;

CREATE POLICY viewer_read_customers ON working.customers
FOR SELECT TO authenticated
USING (working.current_app_role() = 'viewer');

CREATE POLICY viewer_read_purchases ON working.purchases
FOR SELECT TO authenticated
USING (working.current_app_role() = 'viewer');

CREATE POLICY viewer_read_sales ON working.sales
FOR SELECT TO authenticated
USING (working.current_app_role() = 'viewer');

-- Packers can read orders and manage only packing rows.
DO $$
DECLARE
  target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['units', 'item_grades', 'items', 'item_variants'] LOOP
    EXECUTE format(
      'CREATE POLICY packer_read_catalog ON working.%I FOR SELECT TO authenticated '
      'USING (working.current_app_role() = ''packer'')',
      target_table
    );
  END LOOP;
END;
$$;

CREATE POLICY packer_read_customers ON working.customers
FOR SELECT TO authenticated
USING (working.current_app_role() = 'packer');

CREATE POLICY packer_read_sales ON working.sales
FOR SELECT TO authenticated
USING (working.current_app_role() = 'packer');

CREATE POLICY packer_read_status ON working.packing_status
FOR SELECT TO authenticated
USING (working.current_app_role() = 'packer');

CREATE POLICY packer_insert_status ON working.packing_status
FOR INSERT TO authenticated
WITH CHECK (working.current_app_role() = 'packer');

CREATE POLICY packer_update_status ON working.packing_status
FOR UPDATE TO authenticated
USING (working.current_app_role() = 'packer')
WITH CHECK (working.current_app_role() = 'packer');

CREATE POLICY packer_delete_status ON working.packing_status
FOR DELETE TO authenticated
USING (working.current_app_role() = 'packer');
