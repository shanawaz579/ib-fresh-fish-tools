DO $$
BEGIN
  IF (SELECT count(*) FROM working.ice_cans) <> 247 THEN
    RAISE EXCEPTION 'Expected 247 physical Ice Plant positions';
  END IF;
  IF (SELECT count(*) FROM working.ice_cans WHERE is_active) <> 246 THEN
    RAISE EXCEPTION 'Expected 246 active Ice Plant cans';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM working.ice_cans
    WHERE label = 'M19' AND NOT is_active
  ) THEN
    RAISE EXCEPTION 'M19 must remain unavailable';
  END IF;
  IF to_regprocedure('working.get_ice_can_grid(date)') IS NULL
     OR to_regprocedure('working.set_ice_can_status(bigint,date,text)') IS NULL
     OR to_regprocedure('working.verify_ice_can_grid(date)') IS NULL THEN
    RAISE EXCEPTION 'Ice Plant grid RPCs are missing';
  END IF;
END;
$$;
