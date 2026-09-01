import supabase from '../lib/supabase';
import type {
  StockAdjustmentType,
  StockMovement,
  StockSnapshot,
} from '../domain/stockLedger';

type SnapshotRow = {
  item_variant_id: number;
  variant_name: string;
  opening_crates: number | string;
  opening_kg: number | string;
  inward_crates: number | string;
  inward_kg: number | string;
  outward_crates: number | string;
  outward_kg: number | string;
  closing_crates: number | string;
  closing_kg: number | string;
};

export async function getStockSnapshot(date: string): Promise<StockSnapshot[]> {
  const { data, error } = await supabase.rpc('get_stock_snapshot', { p_as_of_date: date });
  if (error) throw error;

  return ((data ?? []) as SnapshotRow[]).map((row) => ({
    itemVariantId: row.item_variant_id,
    variantName: row.variant_name,
    openingCrates: Number(row.opening_crates),
    openingKg: Number(row.opening_kg),
    inwardCrates: Number(row.inward_crates),
    inwardKg: Number(row.inward_kg),
    outwardCrates: Number(row.outward_crates),
    outwardKg: Number(row.outward_kg),
    closingCrates: Number(row.closing_crates),
    closingKg: Number(row.closing_kg),
  }));
}

export async function getStockMovements(date: string): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, item_variants(name)')
    .eq('movement_date', date)
    .order('id', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    movementDate: row.movement_date,
    itemVariantId: row.item_variant_id,
    variantName: row.item_variants?.name ?? 'Unknown item',
    movementType: row.movement_type,
    cratesDelta: Number(row.crates_delta),
    kgDelta: Number(row.kg_delta),
    sourceType: row.source_type ?? undefined,
    sourceId: row.source_id ?? undefined,
    reason: row.reason ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    voidedAt: row.voided_at ?? undefined,
    voidReason: row.void_reason ?? undefined,
  }));
}

export async function recordStockAdjustment(params: {
  itemVariantId: number;
  date: string;
  type: StockAdjustmentType;
  crates: number;
  kg: number;
  reason: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('record_stock_adjustment', {
    p_item_variant_id: params.itemVariantId,
    p_movement_date: params.date,
    p_adjustment_type: params.type,
    p_quantity_crates: params.crates,
    p_quantity_kg: params.kg,
    p_reason: params.reason.trim(),
    p_notes: params.notes?.trim() || null,
  });
  if (error) throw error;
}

export async function reconcileStock(params: {
  itemVariantId: number;
  date: string;
  countedCrates: number;
  countedKg: number;
  reason: string;
  notes?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('reconcile_stock', {
    p_item_variant_id: params.itemVariantId,
    p_movement_date: params.date,
    p_counted_crates: params.countedCrates,
    p_counted_kg: params.countedKg,
    p_reason: params.reason.trim(),
    p_notes: params.notes?.trim() || null,
  });
  if (error) throw error;
}

export async function voidStockAdjustment(movementId: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_stock_adjustment', {
    p_movement_id: movementId,
    p_void_reason: reason.trim(),
  });
  if (error) throw error;
}
