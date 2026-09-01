import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  closeCashDay,
  getDayCloseReadiness,
  getCashbookDay,
  getCashbookEntries,
  recordCashAdjustment,
  reopenCashDay,
  voidCashAdjustment,
} from '../../api/cashbook';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { CashDirection, CashbookDay, CashbookEntry, DayCloseReadiness } from '../../types';

const emptyDay = (date: string): CashbookDay => ({
  business_date: date,
  opening_cash: 0,
  cash_received: 0,
  cash_supplier_payments: 0,
  cash_expenses: 0,
  cash_adjustments_in: 0,
  cash_adjustments_out: 0,
  expected_closing_cash: 0,
  is_closed: false,
  closing: null,
});

const emptyReadiness = (date: string): DayCloseReadiness => ({
  business_date: date,
  status: 'ready',
  is_closed: false,
  can_close: false,
  blocker_count: 0,
  warning_count: 0,
  issues: [],
  activity: { purchases: 0, sales: 0, purchase_bills: 0, sales_bills: 0 },
});

function messageFromError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Please check the details and try again.';
}

export function useCashbook() {
  const businessDate = useBusinessDate();
  const [day, setDay] = useState<CashbookDay>(() => emptyDay(businessDate.date));
  const [entries, setEntries] = useState<CashbookEntry[]>([]);
  const [readiness, setReadiness] = useState<DayCloseReadiness>(() => emptyReadiness(businessDate.date));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, rows, closeReadiness] = await Promise.all([
        getCashbookDay(businessDate.date),
        getCashbookEntries(businessDate.date),
        getDayCloseReadiness(businessDate.date),
      ]);
      setDay(summary);
      setEntries(rows);
      setReadiness(closeReadiness);
    } catch (error) {
      console.error('Unable to load cashbook:', error);
      Alert.alert('Unable to load cashbook', messageFromError(error));
      setDay(emptyDay(businessDate.date));
      setEntries([]);
      setReadiness(emptyReadiness(businessDate.date));
    } finally {
      setLoading(false);
    }
  }, [businessDate.date]);

  useEffect(() => { void load(); }, [load]);

  const addAdjustment = async (direction: CashDirection, amountText: string, reason: string, reference: string) => {
    const amount = Number.parseFloat(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Enter amount', 'Adjustment amount must be greater than zero.');
      return false;
    }
    if (reason.trim().length < 3) {
      Alert.alert('Reason required', 'Enter a clear reason for this cash adjustment.');
      return false;
    }
    setSubmitting(true);
    try {
      await recordCashAdjustment({ date: businessDate.date, direction, amount, reason, referenceNumber: reference });
      await load();
      return true;
    } catch (error) {
      console.error('Unable to record cash adjustment:', error);
      Alert.alert('Unable to record adjustment', messageFromError(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const closeDay = async (countedText: string, notes: string) => {
    const counted = Number.parseFloat(countedText);
    if (!Number.isFinite(counted) || counted < 0) {
      Alert.alert('Enter counted cash', 'Counted cash must be zero or greater.');
      return false;
    }
    setSubmitting(true);
    try {
      await closeCashDay(businessDate.date, counted, notes);
      await load();
      return true;
    } catch (error) {
      console.error('Unable to close cash day:', error);
      Alert.alert('Unable to close day', messageFromError(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const voidAdjustment = async (id: number, reason: string) => {
    setSubmitting(true);
    try {
      await voidCashAdjustment(id, reason);
      await load();
      return true;
    } catch (error) {
      console.error('Unable to void cash adjustment:', error);
      Alert.alert('Unable to void adjustment', messageFromError(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const reopenDay = async (reason: string) => {
    if (!day.closing) return false;
    setSubmitting(true);
    try {
      await reopenCashDay(day.closing.id, reason);
      await load();
      return true;
    } catch (error) {
      console.error('Unable to reopen cash day:', error);
      Alert.alert('Unable to reopen day', messageFromError(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { ...businessDate, day, entries, readiness, loading, submitting, load, addAdjustment, closeDay, voidAdjustment, reopenDay };
}
