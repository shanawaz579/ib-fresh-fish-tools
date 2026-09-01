import { formatBusinessDate } from '../utils/date';

export type PurchaseBillSummary = {
  id: number;
  bill_number: string;
  supplier_id: number;
  supplier_name?: string;
  bill_date: string;
  total: number;
  payment_status: 'pending' | 'partial' | 'paid';
  amount_paid: number;
  balance_due: number;
  location?: string;
  secondary_name?: string;
};

export type PurchaseBillGroup = {
  key: string;
  displayName: string;
  bills: PurchaseBillSummary[];
  totalDue?: number;
};

export type PurchaseBillViewMode = 'date' | 'supplier';

export function groupPurchaseBills(
  bills: PurchaseBillSummary[],
  viewMode: PurchaseBillViewMode,
): PurchaseBillGroup[] {
  return viewMode === 'date' ? groupByDate(bills) : groupBySupplier(bills);
}

function groupByDate(bills: PurchaseBillSummary[]): PurchaseBillGroup[] {
  const groups = new Map<string, PurchaseBillSummary[]>();

  for (const bill of bills) {
    groups.set(bill.bill_date, [...(groups.get(bill.bill_date) ?? []), bill]);
  }

  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, dateBills]) => ({
      key: date,
      displayName: formatBusinessDate(date),
      bills: [...dateBills].sort((a, b) => b.id - a.id),
    }));
}

function groupBySupplier(bills: PurchaseBillSummary[]): PurchaseBillGroup[] {
  const groups = new Map<number, PurchaseBillSummary[]>();

  for (const bill of bills) {
    groups.set(bill.supplier_id, [...(groups.get(bill.supplier_id) ?? []), bill]);
  }

  return [...groups.entries()]
    .map(([supplierId, supplierBills]) => ({
      key: String(supplierId),
      displayName: supplierBills[0]?.supplier_name || 'Unknown Supplier',
      totalDue: supplierBills.reduce((sum, bill) => sum + Number(bill.balance_due), 0),
      bills: [...supplierBills].sort((a, b) => b.bill_date.localeCompare(a.bill_date) || b.id - a.id),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
