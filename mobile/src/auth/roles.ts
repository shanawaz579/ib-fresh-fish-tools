import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'packer' | 'viewer';

// Backward-compatible identities while existing accounts are migrated to
// app_metadata.role in Supabase Auth.
const LEGACY_ROLE_BY_EMAIL: Readonly<Record<string, UserRole>> = {
  'shanawaz579@gmail.com': 'admin',
  'shanawaz_sk@yahoo.com': 'packer',
};

export function getUserRole(user: User | null | undefined): UserRole {
  const metadataRole = user?.app_metadata?.role;
  if (metadataRole === 'admin' || metadataRole === 'packer' || metadataRole === 'viewer') {
    return metadataRole;
  }

  return (user?.email && LEGACY_ROLE_BY_EMAIL[user.email]) || 'viewer';
}
