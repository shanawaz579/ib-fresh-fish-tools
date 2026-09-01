export type StockSnapshot = {
  itemVariantId: number;
  variantName: string;
  openingCrates: number;
  openingKg: number;
  inwardCrates: number;
  inwardKg: number;
  outwardCrates: number;
  outwardKg: number;
  closingCrates: number;
  closingKg: number;
};

export type StockMovementType =
  | 'opening'
  | 'purchase'
  | 'sale'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'wastage'
  | 'sale_return'
  | 'purchase_return'
  | 'reconciliation';

export type StockMovement = {
  id: number;
  movementDate: string;
  itemVariantId: number;
  variantName: string;
  movementType: StockMovementType;
  cratesDelta: number;
  kgDelta: number;
  sourceType?: 'purchase' | 'sale' | 'manual';
  sourceId?: number;
  reason?: string;
  notes?: string;
  createdAt: string;
  voidedAt?: string;
  voidReason?: string;
};

export type StockAdjustmentType =
  | 'adjustment_in'
  | 'adjustment_out'
  | 'wastage'
  | 'sale_return'
  | 'purchase_return';

export function getMovementLabel(type: StockMovementType): string {
  const labels: Record<StockMovementType, string> = {
    opening: 'Opening stock',
    purchase: 'Purchase received',
    sale: 'Sale dispatched',
    adjustment_in: 'Stock added',
    adjustment_out: 'Stock removed',
    wastage: 'Wastage',
    sale_return: 'Sales return',
    purchase_return: 'Supplier return',
    reconciliation: 'Reconciliation',
  };
  return labels[type];
}

export function formatStockQuantity(crates: number, kg: number): string {
  return [
    crates !== 0 ? `${Math.abs(crates)} cr` : '',
    kg !== 0 ? `${Math.abs(kg).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg` : '',
  ].filter(Boolean).join(' · ') || '0';
}

export function formatStockDelta(crates: number, kg: number): string {
  return [
    crates !== 0 ? `${crates > 0 ? '+' : '−'}${Math.abs(crates)} cr` : '',
    kg !== 0 ? `${kg > 0 ? '+' : '−'}${Math.abs(kg).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg` : '',
  ].filter(Boolean).join(' · ') || '0';
}
