BEGIN;

DO $$
DECLARE
  profile_count INTEGER;
  preference_count INTEGER;
BEGIN
  SELECT count(*) INTO profile_count FROM working.business_profile;
  SELECT count(*) INTO preference_count FROM working.business_preferences;

  IF profile_count <> 1 OR preference_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one profile and one preferences record';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM working.business_preferences
    WHERE default_crate_weight_kg = 35
      AND purchase_weight_deduction_percent = 5
      AND mediator_commission_per_kg = 0.50
      AND apply_mediator_commission_by_default
      AND NOT apply_direct_commission_by_default
  ) THEN
    RAISE EXCEPTION 'Default operational settings are invalid';
  END IF;

  IF has_table_privilege('anon', 'working.business_preferences', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous users must not read operational preferences';
  END IF;

  IF NOT has_table_privilege('anon', 'working.business_profile', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous users must be able to read login branding';
  END IF;

  IF has_table_privilege('authenticated', 'working.business_preferences', 'UPDATE') THEN
    RAISE EXCEPTION 'Authenticated users must update settings only through the guarded RPC';
  END IF;
END;
$$;

ROLLBACK;
