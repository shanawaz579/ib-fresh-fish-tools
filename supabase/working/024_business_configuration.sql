-- Configurable single-trader deployment settings.
-- Branding is public so it can be rendered before sign-in. Operational defaults
-- remain available only to authenticated users and editable only by admins.

CREATE TABLE working.business_profile (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  display_name VARCHAR(120) NOT NULL CHECK (btrim(display_name) <> ''),
  legal_name VARCHAR(180),
  tagline VARCHAR(180) NOT NULL CHECK (btrim(tagline) <> ''),
  description VARCHAR(240),
  phone VARCHAR(30),
  email VARCHAR(255),
  address TEXT,
  logo_url TEXT,
  primary_color VARCHAR(7) NOT NULL DEFAULT '#0EA5E9'
    CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE working.business_preferences (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  currency_code VARCHAR(3) NOT NULL DEFAULT 'INR'
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  currency_symbol VARCHAR(8) NOT NULL DEFAULT '₹'
    CHECK (btrim(currency_symbol) <> ''),
  locale VARCHAR(35) NOT NULL DEFAULT 'en-IN'
    CHECK (btrim(locale) <> ''),
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata'
    CHECK (btrim(timezone) <> ''),
  default_crate_weight_kg NUMERIC(8,2) NOT NULL DEFAULT 35
    CHECK (default_crate_weight_kg > 0 AND default_crate_weight_kg <= 1000),
  purchase_weight_deduction_percent NUMERIC(5,2) NOT NULL DEFAULT 5
    CHECK (purchase_weight_deduction_percent BETWEEN 0 AND 100),
  mediator_commission_per_kg NUMERIC(10,2) NOT NULL DEFAULT 0.50
    CHECK (mediator_commission_per_kg >= 0),
  direct_commission_per_kg NUMERIC(10,2) NOT NULL DEFAULT 0.50
    CHECK (direct_commission_per_kg >= 0),
  apply_mediator_commission_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  apply_direct_commission_by_default BOOLEAN NOT NULL DEFAULT FALSE,
  terminology JSONB NOT NULL DEFAULT jsonb_build_object(
    'item', 'Item',
    'supplier', 'Supplier',
    'mediator', 'Mediator',
    'farmer', 'Farmer',
    'customer', 'Customer',
    'crate', 'Crate',
    'weight', 'kg'
  ) CHECK (jsonb_typeof(terminology) = 'object'),
  enabled_modules JSONB NOT NULL DEFAULT jsonb_build_object(
    'purchases', true,
    'sales', true,
    'packing', true,
    'inventory', true,
    'customer_billing', true,
    'supplier_billing', true
  ) CHECK (jsonb_typeof(enabled_modules) = 'object'),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO working.business_profile (
  id, display_name, legal_name, tagline, description
) VALUES (
  1,
  'IB Fresh Fish',
  'IB Fresh Fish',
  'Fish Trading Tools',
  'Inventory & Sales Management'
);

INSERT INTO working.business_preferences (id) VALUES (1);

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON working.business_profile
FOR EACH ROW EXECUTE FUNCTION working.set_updated_at();

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON working.business_preferences
FOR EACH ROW EXECUTE FUNCTION working.set_updated_at();

ALTER TABLE working.business_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE working.business_preferences ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA working TO anon;
GRANT SELECT ON working.business_profile TO anon, authenticated;
GRANT SELECT ON working.business_preferences TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON working.business_profile FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON working.business_preferences FROM anon, authenticated;

CREATE POLICY public_read_business_profile ON working.business_profile
FOR SELECT TO anon, authenticated
USING (id = 1);

CREATE POLICY authenticated_read_business_preferences ON working.business_preferences
FOR SELECT TO authenticated
USING (id = 1);

CREATE OR REPLACE FUNCTION working.update_business_configuration(
  p_profile JSONB,
  p_preferences JSONB,
  p_expected_updated_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = working, pg_temp
AS $$
DECLARE
  updated_preferences working.business_preferences%ROWTYPE;
  updated_profile working.business_profile%ROWTYPE;
BEGIN
  IF working.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can update business settings'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_profile) <> 'object'
     OR jsonb_typeof(p_preferences) <> 'object' THEN
    RAISE EXCEPTION 'Profile and preferences must be JSON objects'
      USING ERRCODE = '22023';
  END IF;

  UPDATE working.business_preferences
  SET
    currency_code = upper(btrim(p_preferences ->> 'currency_code')),
    currency_symbol = btrim(p_preferences ->> 'currency_symbol'),
    locale = btrim(p_preferences ->> 'locale'),
    timezone = btrim(p_preferences ->> 'timezone'),
    default_crate_weight_kg = (p_preferences ->> 'default_crate_weight_kg')::NUMERIC,
    purchase_weight_deduction_percent =
      (p_preferences ->> 'purchase_weight_deduction_percent')::NUMERIC,
    mediator_commission_per_kg =
      (p_preferences ->> 'mediator_commission_per_kg')::NUMERIC,
    direct_commission_per_kg =
      (p_preferences ->> 'direct_commission_per_kg')::NUMERIC,
    apply_mediator_commission_by_default =
      (p_preferences ->> 'apply_mediator_commission_by_default')::BOOLEAN,
    apply_direct_commission_by_default =
      (p_preferences ->> 'apply_direct_commission_by_default')::BOOLEAN,
    terminology = p_preferences -> 'terminology',
    enabled_modules = p_preferences -> 'enabled_modules',
    updated_by = auth.uid()
  WHERE id = 1
    AND updated_at = p_expected_updated_at
  RETURNING * INTO updated_preferences;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business settings changed on another device. Reload and try again.'
      USING ERRCODE = '40001';
  END IF;

  UPDATE working.business_profile
  SET
    display_name = btrim(p_profile ->> 'display_name'),
    legal_name = nullif(btrim(p_profile ->> 'legal_name'), ''),
    tagline = btrim(p_profile ->> 'tagline'),
    description = nullif(btrim(p_profile ->> 'description'), ''),
    phone = nullif(btrim(p_profile ->> 'phone'), ''),
    email = nullif(btrim(p_profile ->> 'email'), ''),
    address = nullif(btrim(p_profile ->> 'address'), ''),
    logo_url = nullif(btrim(p_profile ->> 'logo_url'), ''),
    primary_color = upper(btrim(p_profile ->> 'primary_color'))
  WHERE id = 1
  RETURNING * INTO updated_profile;

  RETURN jsonb_build_object(
    'profile', to_jsonb(updated_profile),
    'preferences', to_jsonb(updated_preferences)
  );
END;
$$;

REVOKE ALL ON FUNCTION working.update_business_configuration(
  JSONB, JSONB, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION working.update_business_configuration(
  JSONB, JSONB, TIMESTAMPTZ
) TO authenticated;

COMMENT ON TABLE working.business_profile IS
  'Public single-trader branding and contact details rendered before sign-in.';
COMMENT ON TABLE working.business_preferences IS
  'Authenticated operational defaults and terminology for this deployment.';
COMMENT ON FUNCTION working.update_business_configuration(JSONB, JSONB, TIMESTAMPTZ) IS
  'Atomically updates the singleton configuration with admin authorization and optimistic locking.';
