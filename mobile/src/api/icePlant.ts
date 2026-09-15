import { supabase } from '../lib/supabase';

export type IceCanStatus = 'water' | 'quarter' | 'half' | 'three_quarter' | 'full';

export type IceRowGridStatus = {
  row_number: number;
  status: IceCanStatus;
  verified: boolean;
  sample_column: string;
  active_can_count: number;
  checked_at: string | null;
};

export type IceGridCell = {
  can_id: number;
  row_number: number;
  column_code: string;
  label: string;
  is_active: boolean;
  row_status: IceCanStatus;
  row_verified: boolean;
  sample_column: string;
  effective_status: IceCanStatus;
  is_override: boolean;
  checked_at: string | null;
};

export async function getIceGridDetail(date: string): Promise<IceGridCell[]> {
  const { data, error } = await supabase.rpc('get_ice_grid_detail', { p_check_date: date });
  if (error) throw error;
  return (data ?? []) as IceGridCell[];
}

export async function getIceRowGrid(date: string): Promise<IceRowGridStatus[]> {
  const { data, error } = await supabase.rpc('get_ice_row_grid', { p_check_date: date });
  if (error) throw error;
  return (data ?? []) as IceRowGridStatus[];
}

export async function setIceRowStatus(rowNumber: number, date: string, status: IceCanStatus): Promise<void> {
  const { data, error } = await supabase.rpc('set_ice_row_status', {
    p_row_number: rowNumber,
    p_check_date: date,
    p_status: status,
  });
  if (error) throw error;
  if (!data) throw new Error('Row status was not saved');
}

export async function setIceCanOverride(canId: number, date: string, status: IceCanStatus): Promise<void> {
  const { data, error } = await supabase.rpc('set_ice_can_override', {
    p_can_id: canId,
    p_check_date: date,
    p_status: status,
  });
  if (error) throw error;
  if (!data) throw new Error('Can status was not saved');
}

export async function setIceSampleColumn(date: string, column: string): Promise<void> {
  const { data, error } = await supabase.rpc('set_ice_sample_column', {
    p_check_date: date,
    p_sample_column: column,
  });
  if (error) throw error;
  if (!data) throw new Error('Sample column was not saved');
}

export async function verifyIceRowGrid(date: string): Promise<number> {
  const { data, error } = await supabase.rpc('verify_ice_row_grid', { p_check_date: date });
  if (error) throw error;
  return Number(data ?? 0);
}
