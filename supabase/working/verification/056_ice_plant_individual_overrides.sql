DO $$
BEGIN
  IF to_regprocedure('working.get_ice_grid_detail(date)') IS NULL
     OR to_regprocedure('working.set_ice_can_override(bigint,date,text)') IS NULL THEN
    RAISE EXCEPTION 'Ice Plant individual override RPCs are missing';
  END IF;
END;
$$;
