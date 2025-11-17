'use server';

import supabase from '@/lib/supabaseClient';

export type InventoryItem = {
  id: number;
  farmer: string;
  fish_type: string;
  crates: number;
  loose_weight: number;
  date: string;
};

export async function getInventoryData(): Promise<InventoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*');

    if (error) {
      console.error('Error fetching inventory:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error:', err);
    return [];
  }
}
