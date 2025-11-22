'use server';

import supabase from '@/lib/supabaseClient';

export type ExpenseCategory = {
  id: number;
  name: string;
  icon?: string;
  color?: string;
};

export type Expense = {
  id: number;
  category_id: number;
  category_name?: string;
  category_color?: string;
  amount: number;
  description?: string;
  payment_method?: string;
  paid_to?: string;
  expense_date: string;
  created_at?: string;
};

// Default expense categories
const DEFAULT_CATEGORIES = [
  { name: 'Fuel/Transport', icon: 'truck', color: '#f59e0b' },
  { name: 'Labor/Wages', icon: 'users', color: '#3b82f6' },
  { name: 'Ice/Cold Storage', icon: 'snowflake', color: '#06b6d4' },
  { name: 'Packaging', icon: 'package', color: '#8b5cf6' },
  { name: 'Vehicle Maintenance', icon: 'wrench', color: '#ef4444' },
  { name: 'Commission/Fees', icon: 'percent', color: '#10b981' },
  { name: 'Food/Refreshments', icon: 'coffee', color: '#f97316' },
  { name: 'Miscellaneous', icon: 'more', color: '#6b7280' },
];

// Fetch all expense categories
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching expense categories:', err);
    return [];
  }
}

// Initialize default categories if none exist
export async function initializeExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    // Check if categories exist
    const { data: existing } = await supabase
      .from('expense_categories')
      .select('id')
      .limit(1);

    if (existing && existing.length > 0) {
      return getExpenseCategories();
    }

    // Insert default categories
    const { data, error } = await supabase
      .from('expense_categories')
      .insert(DEFAULT_CATEGORIES)
      .select();

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error initializing expense categories:', err);
    return [];
  }
}

// Add a new expense category
export async function addExpenseCategory(
  name: string,
  icon?: string,
  color?: string
): Promise<ExpenseCategory | null> {
  try {
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({ name, icon: icon || 'more', color: color || '#6b7280' })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error adding expense category:', err);
    return null;
  }
}

// Update an expense category
export async function updateExpenseCategory(
  id: number,
  name: string,
  icon?: string,
  color?: string
): Promise<ExpenseCategory | null> {
  try {
    const { data, error } = await supabase
      .from('expense_categories')
      .update({ name, icon, color })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating expense category:', err);
    return null;
  }
}

// Delete an expense category
export async function deleteExpenseCategory(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('expense_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting expense category:', err);
    return false;
  }
}

// Fetch expenses for a specific date
export async function getExpensesByDate(date: string): Promise<Expense[]> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_categories(name, color)')
      .eq('expense_date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      category_name: item.expense_categories?.name,
      category_color: item.expense_categories?.color,
    }));
  } catch (err) {
    console.error('Error fetching expenses:', err);
    return [];
  }
}

// Fetch expenses for a date range
export async function getExpensesByDateRange(
  startDate: string,
  endDate: string
): Promise<Expense[]> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*, expense_categories(name, color)')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate)
      .order('expense_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      category_name: item.expense_categories?.name,
      category_color: item.expense_categories?.color,
    }));
  } catch (err) {
    console.error('Error fetching expenses by date range:', err);
    return [];
  }
}

// Add a new expense
export async function addExpense(
  categoryId: number,
  amount: number,
  expenseDate: string,
  description?: string,
  paymentMethod?: string,
  paidTo?: string
): Promise<Expense | null> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        category_id: categoryId,
        amount,
        expense_date: expenseDate,
        description: description || null,
        payment_method: paymentMethod || null,
        paid_to: paidTo || null,
      })
      .select('*, expense_categories(name, color)')
      .single();

    if (error) throw error;

    return {
      ...data,
      category_name: data.expense_categories?.name,
      category_color: data.expense_categories?.color,
    };
  } catch (err) {
    console.error('Error adding expense:', err);
    return null;
  }
}

// Update an expense
export async function updateExpense(
  id: number,
  categoryId: number,
  amount: number,
  description?: string,
  paymentMethod?: string,
  paidTo?: string
): Promise<Expense | null> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .update({
        category_id: categoryId,
        amount,
        description: description || null,
        payment_method: paymentMethod || null,
        paid_to: paidTo || null,
      })
      .eq('id', id)
      .select('*, expense_categories(name, color)')
      .single();

    if (error) throw error;

    return {
      ...data,
      category_name: data.expense_categories?.name,
      category_color: data.expense_categories?.color,
    };
  } catch (err) {
    console.error('Error updating expense:', err);
    return null;
  }
}

// Delete an expense
export async function deleteExpense(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting expense:', err);
    return false;
  }
}

// Get expense summary by category for a date
export async function getExpenseSummaryByDate(date: string): Promise<{
  total: number;
  byCategory: { category_id: number; category_name: string; category_color: string; total: number }[];
}> {
  try {
    const expenses = await getExpensesByDate(date);

    const byCategory: { [key: number]: { category_id: number; category_name: string; category_color: string; total: number } } = {};
    let total = 0;

    expenses.forEach((expense) => {
      total += expense.amount;
      if (!byCategory[expense.category_id]) {
        byCategory[expense.category_id] = {
          category_id: expense.category_id,
          category_name: expense.category_name || 'Unknown',
          category_color: expense.category_color || '#6b7280',
          total: 0,
        };
      }
      byCategory[expense.category_id].total += expense.amount;
    });

    return {
      total,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    };
  } catch (err) {
    console.error('Error getting expense summary:', err);
    return { total: 0, byCategory: [] };
  }
}

// Get monthly expense summary
export async function getMonthlyExpenseSummary(year: number, month: number): Promise<{
  total: number;
  byCategory: { category_id: number; category_name: string; category_color: string; total: number }[];
  byDay: { date: string; total: number }[];
}> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const expenses = await getExpensesByDateRange(startDate, endDate);

    const byCategory: { [key: number]: { category_id: number; category_name: string; category_color: string; total: number } } = {};
    const byDay: { [key: string]: number } = {};
    let total = 0;

    expenses.forEach((expense) => {
      total += expense.amount;

      // By category
      if (!byCategory[expense.category_id]) {
        byCategory[expense.category_id] = {
          category_id: expense.category_id,
          category_name: expense.category_name || 'Unknown',
          category_color: expense.category_color || '#6b7280',
          total: 0,
        };
      }
      byCategory[expense.category_id].total += expense.amount;

      // By day
      if (!byDay[expense.expense_date]) {
        byDay[expense.expense_date] = 0;
      }
      byDay[expense.expense_date] += expense.amount;
    });

    return {
      total,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      byDay: Object.entries(byDay)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  } catch (err) {
    console.error('Error getting monthly expense summary:', err);
    return { total: 0, byCategory: [], byDay: [] };
  }
}
