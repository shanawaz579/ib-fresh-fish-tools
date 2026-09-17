-- Preserve every can's effective status when a new Ice Plant day is initialized.
-- The sampled can becomes today's row baseline and differing cans are carried as exceptions.

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
  previous_date DATE;
  created_day BOOLEAN := FALSE;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can access the Ice Plant grid' USING ERRCODE = '42501';
  END IF;
  IF p_check_date IS NULL OR p_check_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Choose today or an earlier date';
  END IF;

  SELECT inspection.sample_column INTO chosen_column
  FROM working.ice_daily_inspections inspection
  WHERE inspection.check_date = p_check_date;

  IF chosen_column IS NULL THEN
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
    ON CONFLICT (check_date) DO NOTHING
    RETURNING TRUE INTO created_day;

    SELECT inspection.sample_column INTO chosen_column
    FROM working.ice_daily_inspections inspection
    WHERE inspection.check_date = p_check_date;
  END IF;

  SELECT max(inspection.check_date) INTO previous_date
  FROM working.ice_daily_inspections inspection
  WHERE inspection.check_date < p_check_date;

  INSERT INTO working.ice_row_daily_checks (check_date, row_number, status, verified)
  SELECT
    p_check_date,
    row_value::SMALLINT,
    COALESCE(previous_effective.status, 'water'),
    FALSE
  FROM generate_series(1, 19) AS row_value
  LEFT JOIN LATERAL (
    SELECT COALESCE(previous_override.status, previous_row.status)::VARCHAR(16) AS status
    FROM working.ice_row_daily_checks previous_row
    JOIN working.ice_cans sample_can
      ON sample_can.row_number = row_value
     AND sample_can.column_code = chosen_column
     AND sample_can.is_active
    LEFT JOIN working.ice_can_daily_overrides previous_override
      ON previous_override.check_date = previous_date
     AND previous_override.can_id = sample_can.id
    WHERE previous_row.check_date = previous_date
      AND previous_row.row_number = row_value
  ) previous_effective ON TRUE
  ON CONFLICT ON CONSTRAINT ice_row_daily_checks_pkey DO NOTHING;

  IF created_day AND previous_date IS NOT NULL THEN
    INSERT INTO working.ice_can_daily_overrides (check_date, can_id, status, checked_by)
    SELECT
      p_check_date,
      can_row.id,
      COALESCE(previous_override.status, previous_row.status),
      NULL
    FROM working.ice_cans can_row
    JOIN working.ice_row_daily_checks previous_row
      ON previous_row.check_date = previous_date
     AND previous_row.row_number = can_row.row_number
    JOIN working.ice_row_daily_checks current_row
      ON current_row.check_date = p_check_date
     AND current_row.row_number = can_row.row_number
    LEFT JOIN working.ice_can_daily_overrides previous_override
      ON previous_override.check_date = previous_date
     AND previous_override.can_id = can_row.id
    WHERE can_row.is_active
      AND can_row.column_code <> chosen_column
      AND COALESCE(previous_override.status, previous_row.status) <> current_row.status
    ON CONFLICT (check_date, can_id) DO NOTHING;
  END IF;

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

-- Correct today's untouched rows without changing any row already checked today.
WITH previous_day AS (
  SELECT max(check_date) AS check_date
  FROM working.ice_daily_inspections
  WHERE check_date < CURRENT_DATE
)
UPDATE working.ice_row_daily_checks current_row
SET status = COALESCE(previous_override.status, previous_row.status),
    updated_at = NOW()
FROM previous_day
JOIN working.ice_daily_inspections current_inspection
  ON current_inspection.check_date = CURRENT_DATE
JOIN working.ice_cans sample_can
  ON sample_can.column_code = current_inspection.sample_column
 AND sample_can.is_active
JOIN working.ice_row_daily_checks previous_row
  ON previous_row.check_date = previous_day.check_date
 AND previous_row.row_number = sample_can.row_number
LEFT JOIN working.ice_can_daily_overrides previous_override
  ON previous_override.check_date = previous_day.check_date
 AND previous_override.can_id = sample_can.id
WHERE current_row.check_date = CURRENT_DATE
  AND current_row.row_number = sample_can.row_number
  AND NOT current_row.verified
  AND current_row.checked_at IS NULL;

WITH previous_day AS (
  SELECT max(check_date) AS check_date
  FROM working.ice_daily_inspections
  WHERE check_date < CURRENT_DATE
)
INSERT INTO working.ice_can_daily_overrides (check_date, can_id, status, checked_by)
SELECT
  CURRENT_DATE,
  can_row.id,
  COALESCE(previous_override.status, previous_row.status),
  NULL
FROM previous_day
JOIN working.ice_row_daily_checks previous_row
  ON previous_row.check_date = previous_day.check_date
JOIN working.ice_row_daily_checks current_row
  ON current_row.check_date = CURRENT_DATE
 AND current_row.row_number = previous_row.row_number
JOIN working.ice_daily_inspections current_inspection
  ON current_inspection.check_date = CURRENT_DATE
JOIN working.ice_cans can_row
  ON can_row.row_number = previous_row.row_number
 AND can_row.is_active
LEFT JOIN working.ice_can_daily_overrides previous_override
  ON previous_override.check_date = previous_day.check_date
 AND previous_override.can_id = can_row.id
WHERE NOT current_row.verified
  AND current_row.checked_at IS NULL
  AND can_row.column_code <> current_inspection.sample_column
  AND COALESCE(previous_override.status, previous_row.status) <> current_row.status
ON CONFLICT (check_date, can_id) DO NOTHING;

REVOKE ALL ON FUNCTION working.get_ice_row_grid(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.get_ice_row_grid(DATE) TO authenticated;

COMMENT ON FUNCTION working.get_ice_row_grid(DATE) IS
  'Initializes a daily row sample while carrying every active can effective status from the previous check.';
