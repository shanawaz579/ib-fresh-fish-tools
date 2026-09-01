import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  createExpenseCategory,
  getExpenseCategories,
  getFrequentExpenseCategoryIds,
  getExpensesByDate,
  recordExpense,
  voidExpense,
} from '../../api/expenses';
import { summarizeExpenses } from '../../domain/expenses';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { Expense, ExpenseCategory, ExpensePaymentMethod } from '../../types';

function messageFromError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Please check the details and try again.';
}

export function useExpenses() {
  const businessDate = useBusinessDate();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [quickCategoryIds, setQuickCategoryIds] = useState<number[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash');
  const [payee, setPayee] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadCategories = useCallback(async () => {
    const rows = await getExpenseCategories();
    let frequentIds: number[] = [];
    try {
      frequentIds = await getFrequentExpenseCategoryIds();
    } catch (error) {
      console.warn('Unable to load frequent expense categories:', error);
    }
    setCategories(rows);
    setQuickCategoryIds([
      ...frequentIds.filter((id) => rows.some((row) => row.id === id)),
      ...rows.map((row) => row.id).filter((id) => !frequentIds.includes(id)),
    ].slice(0, 5));
    setCategoryId((current) => current && rows.some((row) => row.id === current)
      ? current
      : rows[0]?.id ?? null);
  }, []);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await getExpensesByDate(businessDate.date));
    } catch (error) {
      console.error('Unable to load expenses:', error);
      Alert.alert('Unable to load expenses', 'Check the connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [businessDate.date]);

  useEffect(() => {
    loadCategories().catch((error) => {
      console.error('Unable to load expense categories:', error);
      Alert.alert('Unable to load categories', 'Check the connection and try again.');
    });
  }, [loadCategories]);

  useEffect(() => { void loadExpenses(); }, [loadExpenses]);

  const record = async (): Promise<boolean> => {
    const numericAmount = Number.parseFloat(amount);
    if (!categoryId) {
      Alert.alert('Select category', 'Choose what this expense was for.');
      return false;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert('Enter amount', 'Expense amount must be greater than zero.');
      return false;
    }
    setSubmitting(true);
    try {
      await recordExpense({
        date: businessDate.date,
        categoryId,
        amount: numericAmount,
        paymentMethod,
        payee,
        referenceNumber: reference,
        notes,
      });
      setAmount('');
      setPayee('');
      setReference('');
      setNotes('');
      setPaymentMethod('cash');
      setQuickCategoryIds((current) => [categoryId, ...current.filter((id) => id !== categoryId)].slice(0, 5));
      await loadExpenses();
      return true;
    } catch (error) {
      console.error('Unable to record expense:', error);
      Alert.alert('Unable to record expense', messageFromError(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const createCategory = async (name: string): Promise<boolean> => {
    if (name.trim().length < 2) return false;
    setSubmitting(true);
    try {
      const created = await createExpenseCategory(name);
      await loadCategories();
      setCategoryId(created.id);
      return true;
    } catch (error) {
      console.error('Unable to create expense category:', error);
      Alert.alert('Unable to create category', messageFromError(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const voidEntry = async (expenseId: number, reason: string): Promise<boolean> => {
    setSubmitting(true);
    try {
      await voidExpense(expenseId, reason);
      await loadExpenses();
      return true;
    } catch (error) {
      console.error('Unable to void expense:', error);
      Alert.alert('Unable to void expense', messageFromError(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(() => summarizeExpenses(expenses), [expenses]);

  return {
    ...businessDate,
    categories,
    quickCategories: quickCategoryIds
      .map((id) => categories.find((category) => category.id === id))
      .filter((category): category is ExpenseCategory => Boolean(category)),
    expenses,
    summary,
    categoryId,
    setCategoryId,
    amount,
    setAmount,
    paymentMethod,
    setPaymentMethod,
    payee,
    setPayee,
    reference,
    setReference,
    notes,
    setNotes,
    loading,
    submitting,
    record,
    createCategory,
    voidEntry,
  };
}
