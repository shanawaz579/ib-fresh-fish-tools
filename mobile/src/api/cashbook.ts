import supabase from '../lib/supabase';
import type { CashAdjustment, CashDayClosing, CashDirection, CashbookDay, CashbookEntry, DayCloseReadiness } from '../types';

const moneyFields = [
  'opening_cash', 'cash_received', 'cash_supplier_payments', 'cash_expenses',
  'cash_adjustments_in', 'cash_adjustments_out', 'expected_closing_cash',
] as const;

function normalizeClosing(value: CashDayClosing | null): CashDayClosing | null {
  if (!value) return null;
  return {
    ...value,
    opening_cash: Number(value.opening_cash),
    cash_received: Number(value.cash_received),
    cash_supplier_payments: Number(value.cash_supplier_payments),
    cash_expenses: Number(value.cash_expenses),
    cash_adjustments_in: Number(value.cash_adjustments_in),
    cash_adjustments_out: Number(value.cash_adjustments_out),
    expected_closing_cash: Number(value.expected_closing_cash),
    counted_cash: Number(value.counted_cash),
    difference: Number(value.difference),
  };
}

export async function getDayCloseReadiness(date: string): Promise<DayCloseReadiness> {
  const { data, error } = await supabase.rpc('get_day_close_readiness', { p_business_date: date });
  if (error) throw error;
  const value = data as DayCloseReadiness;
  return {
    ...value,
    blocker_count: Number(value.blocker_count),
    warning_count: Number(value.warning_count),
    issues: (value.issues ?? []).map((issue) => ({
      ...issue,
      count: Number(issue.count),
      ...(issue.amount === undefined ? {} : { amount: Number(issue.amount) }),
    })),
    activity: {
      purchases: Number(value.activity?.purchases ?? 0),
      sales: Number(value.activity?.sales ?? 0),
      purchase_bills: Number(value.activity?.purchase_bills ?? 0),
      sales_bills: Number(value.activity?.sales_bills ?? 0),
    },
  };
}

export async function getCashbookDay(date: string): Promise<CashbookDay> {
  const { data, error } = await supabase.rpc('get_cashbook_day', { p_business_date: date });
  if (error) throw error;
  const value = data as CashbookDay;
  const normalized = { ...value } as CashbookDay;
  moneyFields.forEach((field) => { normalized[field] = Number(value[field]); });
  normalized.closing = normalizeClosing(value.closing);
  return normalized;
}

export async function getCashbookEntries(date: string): Promise<CashbookEntry[]> {
  const { data, error } = await supabase
    .from('cashbook_entries')
    .select('*')
    .eq('business_date', date)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as CashbookEntry[]).map((entry) => ({ ...entry, amount: Number(entry.amount) }));
}

export async function recordCashAdjustment(input: {
  date: string;
  direction: CashDirection;
  amount: number;
  reason: string;
  referenceNumber?: string;
}): Promise<CashAdjustment> {
  const { data, error } = await supabase.rpc('record_cash_adjustment', {
    p_business_date: input.date,
    p_direction: input.direction,
    p_amount: input.amount,
    p_reason: input.reason.trim(),
    p_reference_number: input.referenceNumber?.trim() || null,
  });
  if (error) throw error;
  return { ...(data as CashAdjustment), amount: Number((data as CashAdjustment).amount) };
}

export async function voidCashAdjustment(id: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_cash_adjustment', {
    p_adjustment_id: id,
    p_void_reason: reason.trim(),
  });
  if (error) throw error;
}

export async function closeCashDay(date: string, countedCash: number, notes?: string): Promise<CashDayClosing> {
  const { data, error } = await supabase.rpc('close_cash_day', {
    p_business_date: date,
    p_counted_cash: countedCash,
    p_notes: notes?.trim() || null,
  });
  if (error) throw error;
  return normalizeClosing(data as CashDayClosing)!;
}

export async function reopenCashDay(id: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc('reopen_cash_day', {
    p_closing_id: id,
    p_reason: reason.trim(),
  });
  if (error) throw error;
}
