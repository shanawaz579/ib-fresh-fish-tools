import { supabase } from '../lib/supabase';

export type IcePaymentMethod = 'cash' | 'upi' | 'bank';
export type IceExpenseCategory = 'electricity' | 'labour' | 'maintenance' | 'transport' | 'water' | 'other';
export type IceCustomer = { id: number; name: string };
export type IceMoneyEntry = {
  entry_type: 'sale' | 'expense'; id: number; title: string; detail: string; amount: number;
  amount_paid: number; balance: number; payment_method: IcePaymentMethod | null; created_at: string;
};
export type IceFinanceSummary = {
  sales: number; expenses: number; net: number; blocks: number; received: number;
  outstanding: number; cash: number; upi: number; bank: number;
};

export async function getIceMoneyActivity(date: string): Promise<IceMoneyEntry[]> {
  const { data, error } = await supabase.rpc('get_ice_money_activity', { p_activity_date: date });
  if (error) throw error;
  return (data ?? []).map((row: IceMoneyEntry) => ({ ...row, amount: Number(row.amount), amount_paid: Number(row.amount_paid), balance: Number(row.balance) }));
}

export async function getIceOutstandingSales(): Promise<IceMoneyEntry[]> {
  const { data, error } = await supabase.rpc('get_ice_outstanding_sales');
  if (error) throw error;
  return (data ?? []).map((row: IceMoneyEntry) => ({ ...row, amount: Number(row.amount), amount_paid: Number(row.amount_paid), balance: Number(row.balance) }));
}

export async function getIceFinanceSummary(fromDate: string, toDate: string): Promise<IceFinanceSummary> {
  const { data, error } = await supabase.rpc('get_ice_finance_summary', { p_from_date: fromDate, p_to_date: toDate });
  if (error) throw error;
  const row = data?.[0] ?? {};
  return Object.fromEntries(['sales','expenses','net','blocks','received','outstanding','cash','upi','bank'].map(key => [key, Number(row[key] ?? 0)])) as IceFinanceSummary;
}

export async function getIceCustomers(): Promise<IceCustomer[]> {
  const { data, error } = await supabase.from('ice_customers').select('id,name').eq('is_active', true).order('name');
  if (error) throw error;
  return (data ?? []) as IceCustomer[];
}

export async function createIceCustomer(name: string): Promise<IceCustomer> {
  const { data, error } = await supabase.rpc('create_ice_customer', { p_name: name });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('Customer was not created');
  return row as IceCustomer;
}

export async function recordIceSale(input: { date: string; customerId: number | null; blocks: number; rate: number; received: number; method: IcePaymentMethod; notes: string; reference: string }) {
  const { data, error } = await supabase.rpc('record_ice_sale_v2', {
    p_sale_date: input.date, p_customer_id: input.customerId, p_block_quantity: input.blocks,
    p_rate_per_block: input.rate, p_amount_received: input.received, p_payment_method: input.method,
    p_notes: input.notes, p_reference_number: input.reference,
  });
  if (error) throw error;
  return Number(data);
}

export async function recordIceExpense(input: { date: string; category: IceExpenseCategory; amount: number; method: IcePaymentMethod; payee: string; notes: string; reference: string }) {
  const { data, error } = await supabase.rpc('record_ice_expense', {
    p_expense_date: input.date, p_category: input.category, p_amount: input.amount,
    p_payment_method: input.method, p_payee: input.payee, p_notes: input.notes, p_reference_number: input.reference,
  });
  if (error) throw error;
  return Number(data);
}

export async function recordIcePayment(input: { saleId: number; date: string; amount: number; method: IcePaymentMethod; reference: string }) {
  const { data, error } = await supabase.rpc('record_ice_sale_payment', {
    p_sale_id: input.saleId, p_payment_date: input.date, p_amount: input.amount,
    p_payment_method: input.method, p_reference_number: input.reference,
  });
  if (error) throw error;
  return Number(data);
}

export async function voidIceMoneyEntry(type: 'sale' | 'expense', id: number) {
  const { data, error } = await supabase.rpc('void_ice_money_entry', { p_entry_type: type, p_entry_id: id });
  if (error) throw error;
  if (!data) throw new Error('Entry was not found');
}
