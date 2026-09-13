BEGIN;

DO $$
DECLARE
  first_customer_id BIGINT;
BEGIN
  INSERT INTO working.customers (name, city, phone, email)
  VALUES ('Duplicate Verification Customer', 'Test City', '90000 00001', 'duplicate-verification@example.com')
  RETURNING id INTO first_customer_id;

  BEGIN
    INSERT INTO working.customers (name, city)
    VALUES ('  duplicate   verification customer  ', ' test city ');
    RAISE EXCEPTION 'Normalized name and location duplicate was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO working.customers (name, city, phone)
    VALUES ('Different Name', 'Different City', '+91-90000-00001');
    RAISE EXCEPTION 'Normalized phone duplicate was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO working.customers (name, city, email)
    VALUES ('Another Name', 'Another City', ' DUPLICATE-VERIFICATION@EXAMPLE.COM ');
    RAISE EXCEPTION 'Normalized email duplicate was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO working.customers (name, city)
  VALUES ('Duplicate Verification Customer', 'Another City');
END;
$$;

ROLLBACK;
