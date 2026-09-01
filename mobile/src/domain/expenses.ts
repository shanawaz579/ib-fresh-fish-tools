import type { Expense, ExpensePaymentMethod } from '../types';

export type ExpenseStatusFilter = 'all' | 'active' | 'voided';

export function summarizeExpenses(expenses: Expense[]) {
  return expenses.reduce((summary, expense) => {
    if (expense.voided_at) {
      summary.voidedCount += 1;
      return summary;
    }
    summary.total += expense.amount;
    summary.activeCount += 1;
    summary.byMethod[expense.payment_method] += expense.amount;
    return summary;
  }, {
    total: 0,
    activeCount: 0,
    voidedCount: 0,
    byMethod: {
      cash: 0,
      bank_transfer: 0,
      upi: 0,
      cheque: 0,
      other: 0,
    } as Record<ExpensePaymentMethod, number>,
  });
}

export function filterExpenses(
  expenses: Expense[],
  query: string,
  status: ExpenseStatusFilter,
): Expense[] {
  const normalized = query.trim().toLocaleLowerCase();
  return expenses.filter((expense) => {
    if (status === 'active' && expense.voided_at) return false;
    if (status === 'voided' && !expense.voided_at) return false;
    if (!normalized) return true;
    return [
      expense.category?.name,
      expense.payee,
      expense.reference_number,
      expense.notes,
    ].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized);
  });
}
