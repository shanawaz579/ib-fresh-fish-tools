import supabase from '../lib/supabase';
import type {
  BusinessConfiguration,
  BusinessPreferences,
  BusinessProfile,
} from '../types';

export type BusinessConfigurationUpdate = {
  profile: Omit<BusinessProfile, 'id' | 'created_at' | 'updated_at'>;
  preferences: Omit<
    BusinessPreferences,
    'id' | 'created_at' | 'updated_at' | 'updated_by'
  >;
  expectedUpdatedAt: string;
};

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const { data, error } = await supabase
    .from('business_profile')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) throw error;
  return data as BusinessProfile;
}

export async function getBusinessPreferences(): Promise<BusinessPreferences> {
  const { data, error } = await supabase
    .from('business_preferences')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) throw error;
  return data as BusinessPreferences;
}

export async function updateBusinessConfiguration(
  input: BusinessConfigurationUpdate,
): Promise<BusinessConfiguration> {
  const { data, error } = await supabase.rpc('update_business_configuration', {
    p_profile: input.profile,
    p_preferences: input.preferences,
    p_expected_updated_at: input.expectedUpdatedAt,
  });

  if (error) throw error;
  return data as BusinessConfiguration;
}
