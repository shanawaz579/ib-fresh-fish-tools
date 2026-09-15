DO $$
BEGIN
  IF to_regprocedure('working.set_ice_sample_column(date,text)') IS NULL THEN
    RAISE EXCEPTION 'Safe sample-column RPC is missing';
  END IF;
END;
$$;
