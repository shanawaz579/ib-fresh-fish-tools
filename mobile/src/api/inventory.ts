import supabase from '../lib/supabase';
import type { Purchase, Sale } from '../types';

export interface PackingStatus {
  id: number;
  sale_id: number;
  loaded: boolean;
  loaded_at: string | null;
  loaded_by: string | null;
}

export async function getPurchasesByDate(date: string): Promise<Purchase[]> {
  try {
    const { data, error } = await supabase
      .from('purchases')
      .select('*, suppliers(name, supplier_type), farmers(name), item_variants(name, items(default_kg_per_crate))')
      .eq('purchase_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      supplier_name: item.suppliers?.name,
      supplier_type: item.suppliers?.supplier_type,
      farmer_name: item.farmers?.name,
      fish_variety_name: item.item_variants?.name,
      default_kg_per_crate: item.item_variants?.items?.default_kg_per_crate,
    }));
  } catch (err) {
    console.error('Error fetching purchases:', err);
    return [];
  }
}

export async function getFrequentPurchaseVarietyIds(limit = 6): Promise<number[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('fish_variety_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  const usage = new Map<number, { count: number; latestIndex: number }>();
  (data ?? []).forEach((row, index) => {
    const current = usage.get(row.fish_variety_id);
    usage.set(row.fish_variety_id, {
      count: (current?.count ?? 0) + 1,
      latestIndex: current?.latestIndex ?? index,
    });
  });

  return [...usage.entries()]
    .sort(([, a], [, b]) => b.count - a.count || a.latestIndex - b.latestIndex)
    .slice(0, limit)
    .map(([id]) => id);
}

export async function getFrequentSaleVarietyIds(limit = 8): Promise<number[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('fish_variety_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  const usage = new Map<number, { count: number; latestIndex: number }>();
  (data ?? []).forEach((row, index) => {
    const current = usage.get(row.fish_variety_id);
    usage.set(row.fish_variety_id, {
      count: (current?.count ?? 0) + 1,
      latestIndex: current?.latestIndex ?? index,
    });
  });

  return [...usage.entries()]
    .sort(([, a], [, b]) => b.count - a.count || a.latestIndex - b.latestIndex)
    .slice(0, limit)
    .map(([id]) => id);
}

// Fetch sales for a specific date

export async function getSalesByDate(date: string): Promise<Sale[]> {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*, customers(name), item_variants(name)')
      .eq('sale_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      customer_name: item.customers?.name,
      fish_variety_name: item.item_variants?.name,
    }));
  } catch (err) {
    console.error('Error fetching sales:', err);
    return [];
  }
}

export type PurchaseBatchItem = {
  fishVarietyId: number;
  quantityCrates: number;
  quantityKg: number;
};

export async function createPurchaseBatch(params: {
  supplierId: number;
  farmerName: string;
  purchaseDate: string;
  location?: string;
  items: PurchaseBatchItem[];
}): Promise<void> {
  const { error } = await supabase.rpc('create_purchase_batch', {
    p_supplier_id: params.supplierId,
    p_farmer_name: params.farmerName.trim(),
    p_purchase_date: params.purchaseDate,
    p_location: params.location?.trim() || null,
    p_items: params.items.map((item) => ({
      fish_variety_id: item.fishVarietyId,
      quantity_crates: item.quantityCrates,
      quantity_kg: item.quantityKg,
    })),
  });

  if (error) throw error;
}

export async function updateUnbilledPurchase(params: {
  id: number;
  fishVarietyId: number;
  quantityCrates: number;
  quantityKg: number;
}): Promise<void> {
  const { error } = await supabase
    .from('purchases')
    .update({
      fish_variety_id: params.fishVarietyId,
      quantity_crates: params.quantityCrates,
      quantity_kg: params.quantityKg,
    })
    .eq('id', params.id)
    .eq('billing_status', 'unbilled');

  if (error) throw error;
}

export async function updateUnbilledPurchaseGroup(params: {
  purchaseIds: number[];
  items: Array<{
    id?: number;
    fishVarietyId: number;
    quantityCrates: number;
    quantityKg: number;
  }>;
}): Promise<void> {
  const { error } = await supabase.rpc('update_purchase_group', {
    p_purchase_ids: params.purchaseIds,
    p_items: params.items.map((item) => ({
      id: item.id ?? null,
      fish_variety_id: item.fishVarietyId,
      quantity_crates: item.quantityCrates,
      quantity_kg: item.quantityKg,
    })),
  });

  if (error) throw error;
}

// Add or update a sale

export async function addSale(
  customerId: number,
  fishVarietyId: number,
  quantityCrates: number,
  quantityKg: number,
  saleDate: string
): Promise<Sale | null> {
  try {
    // First, check if a sale already exists for this customer+variety+date
    const { data: existing } = await supabase
      .from('sales')
      .select('id')
      .eq('customer_id', customerId)
      .eq('fish_variety_id', fishVarietyId)
      .eq('sale_date', saleDate)
      .limit(1)
      .single();

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('sales')
        .update({
          quantity_crates: quantityCrates,
          quantity_kg: quantityKg,
        })
        .eq('id', existing.id)
        .select('*, customers(name), item_variants(name)')
        .single();

      if (error) throw error;

      return {
        ...data,
        customer_name: data.customers?.name,
        fish_variety_name: data.item_variants?.name,
      };
    }

    // Create new record
    const { data, error } = await supabase
      .from('sales')
      .insert({
        customer_id: customerId,
        fish_variety_id: fishVarietyId,
        quantity_crates: quantityCrates,
        quantity_kg: quantityKg,
        sale_date: saleDate,
      })
      .select('*, customers(name), item_variants(name)')
      .single();

    if (error) throw error;

    return {
      ...data,
      customer_name: data.customers?.name,
      fish_variety_name: data.item_variants?.name,
    };
  } catch (err) {
    console.error('Error adding sale:', err);
    return null;
  }
}

export async function saveSalesBatch(params: {
  customerId: number;
  saleDate: string;
  items: Array<{ fishVarietyId: number; quantityCrates: number; quantityKg: number }>;
}): Promise<void> {
  const { error } = await supabase.rpc('save_sales_batch', {
    p_customer_id: params.customerId,
    p_sale_date: params.saleDate,
    p_items: params.items.map((item) => ({
      fish_variety_id: item.fishVarietyId,
      quantity_crates: item.quantityCrates,
      quantity_kg: item.quantityKg,
    })),
  });

  if (error) throw error;
}

export async function updateSalesGroup(params: {
  customerId: number;
  saleDate: string;
  items: Array<{ fishVarietyId: number; quantityCrates: number; quantityKg: number }>;
}): Promise<void> {
  const { error } = await supabase.rpc('update_sales_group', {
    p_customer_id: params.customerId,
    p_sale_date: params.saleDate,
    p_items: params.items.map((item) => ({
      fish_variety_id: item.fishVarietyId,
      quantity_crates: item.quantityCrates,
      quantity_kg: item.quantityKg,
    })),
  });

  if (error) throw error;
}

// Update a sale

export async function updateSale(
  id: number,
  customerId: number,
  fishVarietyId: number,
  quantityCrates: number,
  quantityKg: number
): Promise<Sale | null> {
  try {
    const { data, error } = await supabase
      .from('sales')
      .update({
        customer_id: customerId,
        fish_variety_id: fishVarietyId,
        quantity_crates: quantityCrates,
        quantity_kg: quantityKg,
      })
      .eq('id', id)
      .select('*, customers(name), item_variants(name)')
      .single();

    if (error) throw error;

    return {
      ...data,
      customer_name: data.customers?.name,
      fish_variety_name: data.item_variants?.name,
    };
  } catch (err) {
    console.error('Error updating sale:', err);
    return null;
  }
}

// Delete a purchase

export async function deletePurchase(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('purchases')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting purchase:', err);
    return false;
  }
}

export async function deleteUnbilledPurchaseGroup(ids: number[]): Promise<void> {
  if (ids.length === 0) throw new Error('No purchase lines selected');
  const { error } = await supabase.from('purchases').delete().in('id', ids);
  if (error) throw error;
}

// Delete a sale

export async function deleteSale(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting sale:', err);
    return false;
  }
}

// Add a new farmer

export async function cleanupDuplicateSales(saleDate: string): Promise<{ deleted: number }> {
  try {
    const { data: allSales, error: fetchError } = await supabase
      .from('sales')
      .select('id, customer_id, fish_variety_id, created_at')
      .eq('sale_date', saleDate)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    if (!allSales || allSales.length === 0) return { deleted: 0 };

    const seen = new Set<string>();
    const idsToDelete: number[] = [];

    for (const sale of allSales) {
      const key = `${sale.customer_id}-${sale.fish_variety_id}`;
      if (seen.has(key)) {
        idsToDelete.push(sale.id);
      } else {
        seen.add(key);
      }
    }

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('sales')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) throw deleteError;
    }

    return { deleted: idsToDelete.length };
  } catch (err) {
    console.error('Error cleaning up duplicate sales:', err);
    return { deleted: 0 };
  }
}

// ============ BILL FUNCTIONS ============

// Get next bill number

export async function getPackingStatusByDate(date: string): Promise<Map<number, boolean>> {
  try {
    const { data: sales } = await supabase
      .from('sales')
      .select('id')
      .eq('sale_date', date);

    if (!sales || sales.length === 0) return new Map();

    const saleIds = sales.map(s => s.id);

    const { data, error } = await supabase
      .from('packing_status')
      .select('sale_id, loaded')
      .in('sale_id', saleIds);

    if (error) throw error;

    const statusMap = new Map<number, boolean>();
    data?.forEach(status => {
      statusMap.set(status.sale_id, status.loaded);
    });

    return statusMap;
  } catch (err) {
    console.error('Error fetching packing status:', err);
    return new Map();
  }
}

// Toggle packing status for a sale

export async function togglePackingStatus(
  saleId: number,
  loaded: boolean,
  userEmail: string
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from('packing_status')
      .select('id')
      .eq('sale_id', saleId)
      .single();

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('packing_status')
        .update({
          loaded,
          loaded_at: loaded ? new Date().toISOString() : null,
          loaded_by: loaded ? userEmail : null,
        })
        .eq('sale_id', saleId);

      if (error) throw error;
    } else {
      // Insert new record
      const { error } = await supabase
        .from('packing_status')
        .insert({
          sale_id: saleId,
          loaded,
          loaded_at: loaded ? new Date().toISOString() : null,
          loaded_by: loaded ? userEmail : null,
        });

      if (error) throw error;
    }

    return true;
  } catch (err) {
    console.error('Error toggling packing status:', err);
    return false;
  }
}

// Clear all packing status for a specific date (for resetting at end of day)

export async function clearPackingStatusByDate(date: string): Promise<boolean> {
  try {
    const { data: sales } = await supabase
      .from('sales')
      .select('id')
      .eq('sale_date', date);

    if (!sales || sales.length === 0) return true;

    const saleIds = sales.map(s => s.id);

    const { error } = await supabase
      .from('packing_status')
      .delete()
      .in('sale_id', saleIds);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error clearing packing status:', err);
    return false;
  }
}

// ============ PAYMENT FUNCTIONS ============

// Get customer outstanding balance (only active bill)
