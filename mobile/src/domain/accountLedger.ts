export type AccountOverview = {
  accountId: number;
  accountName: string;
  totalBilled: number;
  totalPaid: number;
  accountBalance: number;
  outstandingAmount: number;
  advanceCredit: number;
  lastActivityDate: string | null;
};

export type AccountLedgerEntry = {
  key: string;
  type: 'opening_balance' | 'bill' | 'payment' | 'voided_payment';
  date: string;
  reference: string;
  amount: number;
  direction: 'debit' | 'credit' | 'none';
  balanceAfter: number;
  billId?: number;
  paymentId?: number;
  paymentMode?: string;
  voidReason?: string;
};
