import { environment } from '../config/environment';
import { supabase } from '../lib/supabase';

type PackingShareRow = {
  token: string;
  share_id: string;
  expires_at: string;
};

export type PackingShare = {
  id: string;
  url: string;
  expiresAt: string;
};

export async function createPackingShare(
  packingDate: string,
  customerIds: number[],
  allowUpdates: boolean,
): Promise<PackingShare> {
  const { data, error } = await supabase.rpc('create_packing_share', {
    p_packing_date: packingDate,
    p_customer_ids: customerIds,
    p_allow_updates: allowUpdates,
  });

  if (error) throw error;

  const row = (data as PackingShareRow[] | null)?.[0];
  if (!row?.token || !row.share_id || !row.expires_at) {
    throw new Error('The packing link could not be created.');
  }

  return {
    id: row.share_id,
    expiresAt: row.expires_at,
    url: `${environment.supabaseUrl}/functions/v1/packing-share?token=${encodeURIComponent(row.token)}`,
  };
}

export async function revokePackingShares(packingDate: string): Promise<number> {
  const { data, error } = await supabase.rpc('revoke_packing_shares', {
    p_packing_date: packingDate,
  });

  if (error) throw error;
  return Number(data ?? 0);
}
