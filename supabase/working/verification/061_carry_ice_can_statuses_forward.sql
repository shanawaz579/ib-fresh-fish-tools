DO $$
BEGIN
  IF to_regprocedure('working.get_ice_row_grid(date)') IS NULL THEN
    RAISE EXCEPTION 'Ice Plant carry-forward RPC is missing';
  END IF;
END;
$$;
