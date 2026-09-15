-- Keep the highlighted row-control cell consistent when the sample column changes.

CREATE OR REPLACE FUNCTION working.set_ice_sample_column(p_check_date DATE, p_sample_column TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  normalized_column TEXT := upper(p_sample_column);
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can change the sample column' USING ERRCODE = '42501';
  END IF;
  IF p_check_date IS NULL OR p_check_date > CURRENT_DATE THEN RAISE EXCEPTION 'Choose today or an earlier date'; END IF;
  IF normalized_column IS NULL OR normalized_column NOT IN ('A','B','C','D','E','F','G','H','I','J','K','L') THEN
    RAISE EXCEPTION 'Choose a sample column from A to L';
  END IF;

  PERFORM working.get_ice_row_grid(p_check_date);
  UPDATE working.ice_daily_inspections
  SET sample_column = normalized_column, updated_at = NOW()
  WHERE check_date = p_check_date;

  DELETE FROM working.ice_can_daily_overrides override_row
  USING working.ice_cans can_row
  WHERE override_row.check_date = p_check_date
    AND override_row.can_id = can_row.id
    AND can_row.column_code = normalized_column;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION working.set_ice_sample_column(DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.set_ice_sample_column(DATE, TEXT) TO authenticated;
