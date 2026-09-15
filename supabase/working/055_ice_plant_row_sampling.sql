-- Daily Ice Plant sampling: inspect one A-L column and apply each observation across its row.

CREATE TABLE working.ice_daily_inspections (
  check_date DATE PRIMARY KEY,
  sample_column CHAR(1) NOT NULL CHECK (sample_column BETWEEN 'A' AND 'L'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE working.ice_row_daily_checks (
  check_date DATE NOT NULL REFERENCES working.ice_daily_inspections(check_date) ON DELETE CASCADE,
  row_number SMALLINT NOT NULL CHECK (row_number BETWEEN 1 AND 19),
  status VARCHAR(16) NOT NULL CHECK (status IN ('water', 'quarter', 'half', 'three_quarter', 'full')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (check_date, row_number)
);

ALTER TABLE working.ice_daily_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE working.ice_row_daily_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_access ON working.ice_daily_inspections
FOR ALL TO authenticated
USING (working.current_app_role() = 'admin')
WITH CHECK (working.current_app_role() = 'admin');

CREATE POLICY admin_access ON working.ice_row_daily_checks
FOR ALL TO authenticated
USING (working.current_app_role() = 'admin')
WITH CHECK (working.current_app_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON working.ice_daily_inspections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON working.ice_row_daily_checks TO authenticated;

CREATE OR REPLACE FUNCTION working.get_ice_row_grid(p_check_date DATE)
RETURNS TABLE (
  row_number SMALLINT,
  status TEXT,
  verified BOOLEAN,
  sample_column TEXT,
  active_can_count SMALLINT,
  checked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  chosen_column CHAR(1);
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can access the Ice Plant grid' USING ERRCODE = '42501';
  END IF;
  IF p_check_date IS NULL OR p_check_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Choose today or an earlier date';
  END IF;

  SELECT candidate.column_code INTO chosen_column
  FROM unnest(ARRAY['A','B','C','D','E','F','G','H','I','J','K','L']) AS candidate(column_code)
  LEFT JOIN LATERAL (
    SELECT max(history.check_date) AS last_used
    FROM working.ice_daily_inspections history
    WHERE history.sample_column = candidate.column_code
      AND history.check_date < p_check_date
  ) usage ON TRUE
  ORDER BY usage.last_used NULLS FIRST, candidate.column_code
  LIMIT 1;

  INSERT INTO working.ice_daily_inspections (check_date, sample_column)
  VALUES (p_check_date, chosen_column)
  ON CONFLICT (check_date) DO NOTHING;

  INSERT INTO working.ice_row_daily_checks (check_date, row_number, status, verified)
  SELECT
    p_check_date,
    row_value::SMALLINT,
    COALESCE((
      SELECT previous.status
      FROM working.ice_row_daily_checks previous
      WHERE previous.row_number = row_value
        AND previous.check_date < p_check_date
      ORDER BY previous.check_date DESC
      LIMIT 1
    ), 'water'),
    FALSE
  FROM generate_series(1, 19) AS row_value
  ON CONFLICT ON CONSTRAINT ice_row_daily_checks_pkey DO NOTHING;

  RETURN QUERY
  SELECT
    daily.row_number,
    daily.status::TEXT,
    daily.verified,
    inspection.sample_column::TEXT,
    CASE WHEN daily.row_number = 19 THEN 12 ELSE 13 END::SMALLINT,
    daily.checked_at
  FROM working.ice_row_daily_checks daily
  JOIN working.ice_daily_inspections inspection USING (check_date)
  WHERE daily.check_date = p_check_date
  ORDER BY daily.row_number;
END;
$$;

CREATE OR REPLACE FUNCTION working.set_ice_sample_column(p_check_date DATE, p_sample_column TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can change the sample column' USING ERRCODE = '42501';
  END IF;
  IF p_check_date IS NULL OR p_check_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Choose today or an earlier date';
  END IF;
  IF p_sample_column IS NULL OR upper(p_sample_column) NOT IN ('A','B','C','D','E','F','G','H','I','J','K','L') THEN
    RAISE EXCEPTION 'Choose a sample column from A to L';
  END IF;

  PERFORM working.get_ice_row_grid(p_check_date);
  UPDATE working.ice_daily_inspections
  SET sample_column = upper(p_sample_column), updated_at = NOW()
  WHERE check_date = p_check_date;
  RETURN TRUE;
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
  IF p_check_date IS NULL OR p_check_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Choose today or an earlier date';
  END IF;
  IF p_row_number NOT BETWEEN 1 AND 19 THEN RAISE EXCEPTION 'Invalid row'; END IF;
  IF p_status NOT IN ('water', 'quarter', 'half', 'three_quarter', 'full') THEN
    RAISE EXCEPTION 'Invalid can status';
  END IF;

  PERFORM working.get_ice_row_grid(p_check_date);
  UPDATE working.ice_row_daily_checks
  SET status = p_status, verified = TRUE, checked_at = NOW(), checked_by = auth.uid(), updated_at = NOW()
  WHERE check_date = p_check_date AND row_number = p_row_number;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION working.verify_ice_row_grid(p_check_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  verified_count INTEGER;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can verify the Ice Plant grid' USING ERRCODE = '42501';
  END IF;
  IF p_check_date IS NULL OR p_check_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Choose today or an earlier date';
  END IF;

  PERFORM working.get_ice_row_grid(p_check_date);
  UPDATE working.ice_row_daily_checks
  SET verified = TRUE, checked_at = NOW(), checked_by = auth.uid(), updated_at = NOW()
  WHERE check_date = p_check_date AND NOT verified;

  SELECT count(*)::INTEGER INTO verified_count
  FROM working.ice_row_daily_checks
  WHERE check_date = p_check_date AND verified;
  RETURN verified_count;
END;
$$;

REVOKE ALL ON FUNCTION working.get_ice_row_grid(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION working.set_ice_sample_column(DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION working.set_ice_row_status(SMALLINT, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION working.verify_ice_row_grid(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.get_ice_row_grid(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION working.set_ice_sample_column(DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION working.set_ice_row_status(SMALLINT, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION working.verify_ice_row_grid(DATE) TO authenticated;

COMMENT ON TABLE working.ice_row_daily_checks IS
  'One observed can per row; its status estimates every active can in that physical row.';
