BEGIN;

-- Normalize any currently active link to the same 24-hour lifetime used for
-- all newly created links.
UPDATE working.packing_share_links
   SET expires_at = created_at + INTERVAL '24 hours'
 WHERE revoked_at IS NULL
   AND expires_at > NOW();

CREATE OR REPLACE FUNCTION working.create_packing_share(
  p_packing_date DATE,
  p_customer_ids BIGINT[],
  p_allow_updates BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(token TEXT, share_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, extensions, pg_temp
AS $$
DECLARE
  business_timezone TEXT;
  business_today DATE;
  normalized_customer_ids BIGINT[];
  raw_token TEXT;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only an administrator can share a packing list';
  END IF;

  SELECT COALESCE(preferences.timezone, 'Asia/Kolkata')
    INTO business_timezone
    FROM working.business_preferences preferences
   WHERE preferences.id = 1;

  business_timezone := COALESCE(business_timezone, 'Asia/Kolkata');
  business_today := (NOW() AT TIME ZONE business_timezone)::DATE;

  IF p_packing_date IS DISTINCT FROM business_today THEN
    RAISE EXCEPTION 'Only today''s packing list can be shared';
  END IF;

  IF COALESCE(cardinality(p_customer_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one customer';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(p_customer_ids) selected(customer_id)
     WHERE NOT EXISTS (
       SELECT 1
         FROM working.sales sale
        WHERE sale.sale_date = p_packing_date
          AND sale.customer_id = selected.customer_id
     )
  ) THEN
    RAISE EXCEPTION 'The selection contains a customer without sales for this date';
  END IF;

  SELECT array_agg(DISTINCT selected.customer_id ORDER BY selected.customer_id)
    INTO normalized_customer_ids
    FROM unnest(p_customer_ids) selected(customer_id);

  UPDATE working.packing_share_links
     SET revoked_at = NOW()
   WHERE packing_date = p_packing_date
     AND created_by = auth.uid()
     AND revoked_at IS NULL;

  raw_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO working.packing_share_links (
    token_hash,
    packing_date,
    customer_ids,
    allow_updates,
    expires_at,
    created_by
  )
  VALUES (
    encode(extensions.digest(raw_token, 'sha256'), 'hex'),
    p_packing_date,
    normalized_customer_ids,
    COALESCE(p_allow_updates, TRUE),
    NOW() + INTERVAL '24 hours',
    auth.uid()
  )
  RETURNING id, packing_share_links.expires_at
       INTO share_id, expires_at;

  token := raw_token;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION working.create_packing_share(DATE, BIGINT[], BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.create_packing_share(DATE, BIGINT[], BOOLEAN) TO authenticated;

COMMIT;
