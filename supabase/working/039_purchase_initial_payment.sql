BEGIN;

CREATE OR REPLACE FUNCTION working.create_purchase_bill_with_payment(
  p_supplier_id BIGINT,
  p_bill_date DATE,
  p_items JSONB,
  p_commission_per_kg NUMERIC DEFAULT 0,
  p_payment_amount NUMERIC DEFAULT 0,
  p_payment_mode VARCHAR DEFAULT 'cash',
  p_payment_reference TEXT DEFAULT NULL,
  p_other_charges_addition NUMERIC DEFAULT 0,
  p_other_charges_deduction NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL
)
RETURNS working.purchase_bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  created_bill working.purchase_bills%ROWTYPE;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can create purchase bills' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_payment_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Initial payment cannot be negative';
  END IF;

  SELECT * INTO created_bill
  FROM working.create_purchase_bill(
    p_supplier_id, p_bill_date, p_items, p_commission_per_kg,
    0, p_other_charges_addition, p_other_charges_deduction,
    p_notes, p_location
  );

  IF coalesce(p_payment_amount, 0) > 0 THEN
    PERFORM working.record_purchase_bill_payment(
      created_bill.id,
      p_bill_date,
      p_payment_amount,
      p_payment_mode,
      p_payment_reference,
      'Initial payment recorded with bill creation'
    );
    SELECT * INTO created_bill
    FROM working.purchase_bills WHERE id = created_bill.id;
  END IF;

  RETURN created_bill;
END;
$$;

CREATE OR REPLACE FUNCTION working.revise_purchase_bill_with_payment(
  p_purchase_bill_id BIGINT,
  p_reason TEXT,
  p_supplier_id BIGINT,
  p_bill_date DATE,
  p_items JSONB,
  p_commission_per_kg NUMERIC DEFAULT 0,
  p_payment_amount NUMERIC DEFAULT 0,
  p_payment_mode VARCHAR DEFAULT 'cash',
  p_payment_reference TEXT DEFAULT NULL,
  p_other_charges_addition NUMERIC DEFAULT 0,
  p_other_charges_deduction NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL
)
RETURNS working.purchase_bills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  replacement_bill working.purchase_bills%ROWTYPE;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can revise purchase bills' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_payment_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Initial payment cannot be negative';
  END IF;

  SELECT * INTO replacement_bill
  FROM working.revise_purchase_bill(
    p_purchase_bill_id, p_reason, p_supplier_id, p_bill_date, p_items,
    p_commission_per_kg, 0, p_other_charges_addition,
    p_other_charges_deduction, p_notes, p_location
  );

  IF coalesce(p_payment_amount, 0) > 0 THEN
    PERFORM working.record_purchase_bill_payment(
      replacement_bill.id,
      p_bill_date,
      p_payment_amount,
      p_payment_mode,
      p_payment_reference,
      'Initial payment recorded with corrected bill'
    );
    SELECT * INTO replacement_bill
    FROM working.purchase_bills WHERE id = replacement_bill.id;
  END IF;

  RETURN replacement_bill;
END;
$$;

REVOKE ALL ON FUNCTION working.create_purchase_bill_with_payment(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, VARCHAR, TEXT, NUMERIC, NUMERIC, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.create_purchase_bill_with_payment(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, VARCHAR, TEXT, NUMERIC, NUMERIC, TEXT, TEXT
) TO authenticated;

REVOKE ALL ON FUNCTION working.revise_purchase_bill_with_payment(
  BIGINT, TEXT, BIGINT, DATE, JSONB, NUMERIC, NUMERIC, VARCHAR, TEXT, NUMERIC, NUMERIC, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.revise_purchase_bill_with_payment(
  BIGINT, TEXT, BIGINT, DATE, JSONB, NUMERIC, NUMERIC, VARCHAR, TEXT, NUMERIC, NUMERIC, TEXT, TEXT
) TO authenticated;

-- The app must use the atomic wrappers so an initial payment cannot be lost
-- between bill creation and payment recording.
REVOKE EXECUTE ON FUNCTION working.create_purchase_bill(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
) FROM authenticated;
REVOKE EXECUTE ON FUNCTION working.revise_purchase_bill(
  BIGINT, TEXT, BIGINT, DATE, JSONB, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT
) FROM authenticated;

COMMENT ON FUNCTION working.create_purchase_bill_with_payment(
  BIGINT, DATE, JSONB, NUMERIC, NUMERIC, VARCHAR, TEXT, NUMERIC, NUMERIC, TEXT, TEXT
) IS 'Atomically creates a full-value purchase bill and records any initial supplier payment separately.';

COMMIT;
