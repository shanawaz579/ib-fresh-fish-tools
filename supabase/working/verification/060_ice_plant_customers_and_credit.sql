DO $$ BEGIN
  IF to_regclass('working.ice_customers') IS NULL OR to_regprocedure('working.create_ice_customer(text)') IS NULL
    OR to_regprocedure('working.record_ice_sale_v2(date,bigint,integer,numeric,numeric,text,text,text)') IS NULL
  THEN RAISE EXCEPTION 'Ice customer setup is incomplete'; END IF;
END $$;
