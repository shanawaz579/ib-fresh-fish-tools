export type SupplierLedgerEntry = {
  key: string;
  type: 'bill' | 'payment' | 'voided_payment';
  date: string;
  billId?: number;
  billNumber: string;
  amount: number;
  balanceAfter: number;
  paymentMode?: string;
  referenceNumber?: string;
};

export type SupplierLedgerAccount = {
  supplierId: number;
  supplierName: string;
  totalBilled: number;
  totalPaid: number;
  balanceDue: number;
  entries: SupplierLedgerEntry[];
};
