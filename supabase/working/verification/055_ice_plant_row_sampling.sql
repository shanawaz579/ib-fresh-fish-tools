DO $$
BEGIN
  IF to_regprocedure('working.get_ice_row_grid(date)') IS NULL
     OR to_regprocedure('working.set_ice_sample_column(date,text)') IS NULL
     OR to_regprocedure('working.set_ice_row_status(smallint,date,text)') IS NULL
     OR to_regprocedure('working.verify_ice_row_grid(date)') IS NULL THEN
    RAISE EXCEPTION 'Ice Plant row-sampling RPCs are missing';
  END IF;
END;
$$;
