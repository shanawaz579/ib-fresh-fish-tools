import supabase from '../lib/supabase';
import type { AccountLedgerEntry, AccountOverview } from '../domain/accountLedger';

type OverviewRow = {
  account_id: number;
  account_name: string;
  total_billed: number | string;
  total_paid: number | string;
  account_balance: number | string;
  outstanding_amount: number | string;
  advance_credit: number | string;
  last_activity_date: string | null;
};

type LedgerRow = {
  transaction_key: string;
  transaction_type: AccountLedgerEntry['type'];
  transaction_date: string;
  reference: string;
  amount: number | string;
  direction: AccountLedgerEntry['direction'];
  balance_after: number | string;
  bill_id: number | null;
  payment_id: number | null;
  payment_mode: string | null;
  void_reason: string | null;
};

const mapOverview = (row: OverviewRow): AccountOverview => ({
  accountId: Number(row.account_id),
  accountName: row.account_name,
  totalBilled: Number(row.total_billed) || 0,
  totalPaid: Number(row.total_paid) || 0,
  accountBalance: Number(row.account_balance) || 0,
  outstandingAmount: Number(row.outstanding_amount) || 0,
  advanceCredit: Number(row.advance_credit) || 0,
  lastActivityDate: row.last_activity_date,
});

const mapEntry = (row: LedgerRow): AccountLedgerEntry => ({
  key: row.transaction_key,
  type: row.transaction_type,
  date: row.transaction_date,
  reference: row.reference,
  amount: Number(row.amount) || 0,
  direction: row.direction,
  balanceAfter: Number(row.balance_after) || 0,
  billId: row.bill_id ?? undefined,
  paymentId: row.payment_id ?? undefined,
  paymentMode: row.payment_mode ?? undefined,
  voidReason: row.void_reason ?? undefined,
});

async function getOverview(functionName: string, asOfDate: string): Promise<AccountOverview[]> {
  const { data, error } = await supabase.rpc(functionName, { p_as_of_date: asOfDate });
  if (error) throw error;
  return ((data ?? []) as OverviewRow[]).map(mapOverview);
}

async function getLedger(functionName: string, parameterName: string, accountId: number, asOfDate: string): Promise<AccountLedgerEntry[]> {
  const { data, error } = await supabase.rpc(functionName, {
    [parameterName]: accountId,
    p_as_of_date: asOfDate,
  });
  if (error) throw error;
  return ((data ?? []) as LedgerRow[]).map(mapEntry);
}

export const getCustomerAccountOverview = (asOfDate: string) =>
  getOverview('get_customer_account_overview', asOfDate);

export const getCustomerAccountLedger = (customerId: number, asOfDate: string) =>
  getLedger('get_customer_account_ledger', 'p_customer_id', customerId, asOfDate);

export const getSupplierAccountOverview = (asOfDate: string) =>
  getOverview('get_supplier_account_overview', asOfDate);

export const getSupplierAccountLedger = (supplierId: number, asOfDate: string) =>
  getLedger('get_supplier_account_ledger', 'p_supplier_id', supplierId, asOfDate);
