export type RegisterPaymentMethod = 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'other';
export type PaymentDirection = 'received' | 'paid';

export type PaymentRegisterEntry = {
  key: string;
  sourceId: number;
  direction: PaymentDirection;
  paymentDate: string;
  amount: number;
  method: RegisterPaymentMethod;
  partyId: number;
  partyName: string;
  billId: number | null;
  billNumber: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type PaymentRegisterTotals = {
  received: number;
  paid: number;
  net: number;
  count: number;
};

export function calculatePaymentRegisterTotals(entries: PaymentRegisterEntry[]): PaymentRegisterTotals {
  return entries.reduce((totals, entry) => {
    if (entry.voidedAt) return totals;
    if (entry.direction === 'received') totals.received += entry.amount;
    else totals.paid += entry.amount;
    totals.count += 1;
    totals.net = totals.received - totals.paid;
    return totals;
  }, { received: 0, paid: 0, net: 0, count: 0 });
}

export function paymentMethodLabel(method: RegisterPaymentMethod): string {
  if (method === 'bank_transfer') return 'Bank';
  if (method === 'upi') return 'UPI';
  return method.charAt(0).toUpperCase() + method.slice(1);
}
