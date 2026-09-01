import type { BillOtherCharge, Sale } from '../types';
import { DEFAULT_CRATE_WEIGHT_KG, getTotalWeightKg } from './fish';

export type BillItemForm = {
  sale_ids: number[];
  fish_variety_id: number;
  fish_variety_name: string;
  quantity_crates: number;
  quantity_kg: number;
  crate_weight: number;
  total_weight: number;
  rate_per_kg: number;
};

type RateLoader = (varietyId: number) => Promise<{ rate_per_kg: number } | null>;

export async function buildBillItemsFromSales(
  sales: Sale[],
  loadRate: RateLoader,
  defaultCrateWeightKg = DEFAULT_CRATE_WEIGHT_KG,
): Promise<BillItemForm[]> {
  const grouped = new Map<number, Omit<BillItemForm, 'rate_per_kg'>>();

  for (const sale of sales) {
    const current = grouped.get(sale.fish_variety_id) ?? {
      sale_ids: [],
      fish_variety_id: sale.fish_variety_id,
      fish_variety_name: sale.fish_variety_name || 'Unknown',
      quantity_crates: 0,
      quantity_kg: 0,
      crate_weight: defaultCrateWeightKg,
      total_weight: 0,
    };
    current.sale_ids.push(sale.id);
    current.quantity_crates += sale.quantity_crates;
    current.quantity_kg += sale.quantity_kg;
    current.total_weight = getTotalWeightKg(current.quantity_crates, current.quantity_kg, current.crate_weight);
    grouped.set(sale.fish_variety_id, current);
  }

  return Promise.all([...grouped.values()].map(async item => ({
    ...item,
    rate_per_kg: (await loadRate(item.fish_variety_id))?.rate_per_kg || 0,
  })));
}

export function calculateBillItemAmount(item: BillItemForm): number {
  return Math.round(item.total_weight * item.rate_per_kg);
}

export function calculateCustomerBillTotals(
  items: BillItemForm[],
  charges: BillOtherCharge[],
  previousBalanceDue: number,
  quickPayments: Array<{ amount: number }>,
) {
  const itemsTotal = items.reduce((sum, item) => sum + calculateBillItemAmount(item), 0);
  const chargesTotal = charges.reduce((sum, charge) => sum + charge.amount, 0);
  const subtotal = itemsTotal + chargesTotal;
  const quickPaymentsTotal = quickPayments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    itemsTotal,
    chargesTotal,
    subtotal,
    quickPaymentsTotal,
    total: previousBalanceDue + subtotal - quickPaymentsTotal,
  };
}
