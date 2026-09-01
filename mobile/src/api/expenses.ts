import supabase from '../lib/supabase';
import type { Expense, ExpenseCategory, ExpensePaymentMethod } from '../types';

export async function getExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
  let query = supabase
    .from('expense_categories')
    .select('*')
    .order('sort_order')
    .order('name');

  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ExpenseCategory[];
}

export async function getExpensesByDate(date: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, category:expense_categories(id, code, name)')
    .eq('expense_date', date)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as Expense[]).map((expense) => ({
    ...expense,
    amount: Number(expense.amount),
  }));
}

export async function getFrequentExpenseCategoryIds(limit = 5): Promise<number[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('category_id')
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  const usage = new Map<number, { count: number; mostRecentIndex: number }>();
  (data ?? []).forEach((row, index) => {
    const categoryId = Number(row.category_id);
    const current = usage.get(categoryId);
    usage.set(categoryId, {
      count: (current?.count ?? 0) + 1,
      mostRecentIndex: current?.mostRecentIndex ?? index,
    });
  });

  return [...usage.entries()]
    .sort(([, left], [, right]) => right.count - left.count || left.mostRecentIndex - right.mostRecentIndex)
    .slice(0, limit)
    .map(([categoryId]) => categoryId);
}

export async function recordExpense(input: {
  date: string;
  categoryId: number;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  payee?: string;
  referenceNumber?: string;
  notes?: string;
}): Promise<Expense> {
  const { data, error } = await supabase.rpc('record_expense', {
    p_expense_date: input.date,
    p_category_id: input.categoryId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_payee: input.payee?.trim() || null,
    p_reference_number: input.referenceNumber?.trim() || null,
    p_notes: input.notes?.trim() || null,
  });

  if (error) throw error;
  return data as Expense;
}

export async function voidExpense(expenseId: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc('void_expense', {
    p_expense_id: expenseId,
    p_void_reason: reason.trim(),
  });
  if (error) throw error;
}

export function generateExpenseCategoryCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export async function createExpenseCategory(name: string): Promise<ExpenseCategory> {
  const { data, error } = await supabase.rpc('upsert_expense_category', {
    p_category_id: null,
    p_code: generateExpenseCategoryCode(name),
    p_name: name.trim(),
    p_sort_order: 100,
  });

  if (error) throw error;
  return data as ExpenseCategory;
}
