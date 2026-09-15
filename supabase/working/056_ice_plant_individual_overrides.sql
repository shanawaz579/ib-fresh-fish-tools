-- Individual can exceptions on top of the daily sampled row status.

CREATE TABLE working.ice_can_daily_overrides (
  check_date DATE NOT NULL REFERENCES working.ice_daily_inspections(check_date) ON DELETE CASCADE,
  can_id BIGINT NOT NULL REFERENCES working.ice_cans(id) ON DELETE RESTRICT,
  status VARCHAR(16) NOT NULL CHECK (status IN ('water', 'quarter', 'half', 'three_quarter', 'full')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (check_date, can_id)
);

ALTER TABLE working.ice_can_daily_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_access ON working.ice_can_daily_overrides
FOR ALL TO authenticated
USING (working.current_app_role() = 'admin')
WITH CHECK (working.current_app_role() = 'admin');
GRANT SELECT, INSERT, UPDATE, DELETE ON working.ice_can_daily_overrides TO authenticated;

CREATE OR REPLACE FUNCTION working.get_ice_grid_detail(p_check_date DATE)
RETURNS TABLE (
  can_id BIGINT,
  row_number SMALLINT,
  column_code TEXT,
  label TEXT,
  is_active BOOLEAN,
  row_status TEXT,
  row_verified BOOLEAN,
  sample_column TEXT,
  effective_status TEXT,
  is_override BOOLEAN,
  checked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can access the Ice Plant grid' USING ERRCODE = '42501';
  END IF;

  PERFORM working.get_ice_row_grid(p_check_date);
  RETURN QUERY
  SELECT
    can_row.id,
    can_row.row_number,
    can_row.column_code::TEXT,
    can_row.label::TEXT,
    can_row.is_active,
    daily.status::TEXT,
    daily.verified,
    inspection.sample_column::TEXT,
    COALESCE(override_row.status, daily.status)::TEXT,
    override_row.can_id IS NOT NULL,
    COALESCE(override_row.checked_at, daily.checked_at)
  FROM working.ice_cans can_row
  JOIN working.ice_daily_inspections inspection ON inspection.check_date = p_check_date
  JOIN working.ice_row_daily_checks daily
    ON daily.check_date = p_check_date AND daily.row_number = can_row.row_number
  LEFT JOIN working.ice_can_daily_overrides override_row
    ON override_row.check_date = p_check_date AND override_row.can_id = can_row.id
  ORDER BY can_row.row_number, can_row.column_code;
END;
$$;

CREATE OR REPLACE FUNCTION working.set_ice_row_status(
  p_row_number SMALLINT,
  p_check_date DATE,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can update the Ice Plant grid' USING ERRCODE = '42501';
  END IF;
  IF p_check_date IS NULL OR p_check_date > CURRENT_DATE THEN RAISE EXCEPTION 'Choose today or an earlier date'; END IF;
  IF p_row_number NOT BETWEEN 1 AND 19 THEN RAISE EXCEPTION 'Invalid row'; END IF;
  IF p_status NOT IN ('water', 'quarter', 'half', 'three_quarter', 'full') THEN RAISE EXCEPTION 'Invalid can status'; END IF;

  PERFORM working.get_ice_row_grid(p_check_date);
  UPDATE working.ice_row_daily_checks
  SET status = p_status, verified = TRUE, checked_at = NOW(), checked_by = auth.uid(), updated_at = NOW()
  WHERE check_date = p_check_date AND row_number = p_row_number;

  -- A new sample represents the complete row, so any older exceptions are cleared.
  DELETE FROM working.ice_can_daily_overrides override_row
  USING working.ice_cans can_row
  WHERE override_row.check_date = p_check_date
    AND override_row.can_id = can_row.id
    AND can_row.row_number = p_row_number;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION working.set_ice_can_override(
  p_can_id BIGINT,
  p_check_date DATE,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  target_can working.ice_cans%ROWTYPE;
  baseline_status TEXT;
  selected_column TEXT;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can update the Ice Plant grid' USING ERRCODE = '42501';
  END IF;
  IF p_check_date IS NULL OR p_check_date > CURRENT_DATE THEN RAISE EXCEPTION 'Choose today or an earlier date'; END IF;
  IF p_status NOT IN ('water', 'quarter', 'half', 'three_quarter', 'full') THEN RAISE EXCEPTION 'Invalid can status'; END IF;

  PERFORM working.get_ice_row_grid(p_check_date);
  SELECT * INTO target_can FROM working.ice_cans WHERE id = p_can_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'This can is unavailable'; END IF;

  SELECT daily.status, inspection.sample_column
  INTO baseline_status, selected_column
  FROM working.ice_row_daily_checks daily
  JOIN working.ice_daily_inspections inspection ON inspection.check_date = daily.check_date
  WHERE daily.check_date = p_check_date AND daily.row_number = target_can.row_number;

  IF target_can.column_code = selected_column THEN
    RAISE EXCEPTION 'Use the highlighted sample cell to update the complete row';
  END IF;

  IF p_status = baseline_status THEN
    DELETE FROM working.ice_can_daily_overrides WHERE check_date = p_check_date AND can_id = p_can_id;
  ELSE
    INSERT INTO working.ice_can_daily_overrides (check_date, can_id, status, checked_at, checked_by, updated_at)
    VALUES (p_check_date, p_can_id, p_status, NOW(), auth.uid(), NOW())
    ON CONFLICT (check_date, can_id) DO UPDATE SET
      status = EXCLUDED.status, checked_at = NOW(), checked_by = auth.uid(), updated_at = NOW();
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION working.get_ice_grid_detail(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION working.set_ice_can_override(BIGINT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.get_ice_grid_detail(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION working.set_ice_can_override(BIGINT, DATE, TEXT) TO authenticated;

COMMENT ON TABLE working.ice_can_daily_overrides IS
  'Auditable individual can exceptions layered over a sampled row status.';
