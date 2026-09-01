import type { CashbookDay, CashbookEntry } from '../types';

export function activeCashbookEntries(entries: CashbookEntry[]): CashbookEntry[] {
  return entries.filter((entry) => !entry.voided_at);
}

export function cashbookMovementTotals(day: CashbookDay) {
  return {
    totalIn: day.cash_received + day.cash_adjustments_in,
    totalOut: day.cash_supplier_payments + day.cash_expenses + day.cash_adjustments_out,
  };
}

export function cashDifferenceLabel(difference: number): string {
  if (difference === 0) return 'Balanced';
  return difference > 0 ? 'Cash over' : 'Cash short';
}
