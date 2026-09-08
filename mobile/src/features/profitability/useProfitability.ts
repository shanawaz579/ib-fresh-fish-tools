import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { getProfitabilityReport } from '../../api/profitability';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { ProfitabilityReport } from '../../types';
import { addDays, parseLocalDate, toLocalDateString } from '../../utils/date';

export type ProfitabilityRange = 'today' | 'seven_days' | 'month' | 'custom';

function messageFromError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Please check the connection and try again.';
}

export function useProfitability() {
  const businessDate = useBusinessDate();
  const [range, setRange] = useState<ProfitabilityRange>('today');
  const [report, setReport] = useState<ProfitabilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [customFrom, setCustomFrom] = useState(addDays(businessDate.date, -6));
  const [customTo, setCustomTo] = useState(businessDate.date);
  const [appliedCustomRange, setAppliedCustomRange] = useState({ from: customFrom, to: customTo });
  const dateFrom = useMemo(() => {
    if (range === 'custom') return appliedCustomRange.from;
    if (range === 'seven_days') return addDays(businessDate.date, -6);
    if (range === 'month') return `${businessDate.date.slice(0, 8)}01`;
    return businessDate.date;
  }, [appliedCustomRange.from, businessDate.date, range]);
  const dateTo = range === 'custom' ? appliedCustomRange.to : businessDate.date;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await getProfitabilityReport(dateFrom, dateTo));
    } catch (error) {
      console.error('Unable to load profitability:', error);
      Alert.alert('Unable to load profitability', messageFromError(error));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  const applyCustomRange = () => {
    try {
      if (toLocalDateString(parseLocalDate(customFrom)) !== customFrom
          || toLocalDateString(parseLocalDate(customTo)) !== customTo) throw new Error('Invalid date');
    } catch {
      Alert.alert('Invalid dates', 'Enter both dates in YYYY-MM-DD format.');
      return;
    }
    if (customFrom > customTo) {
      Alert.alert('Invalid range', 'From date must be before or equal to To date.');
      return;
    }
    if (customTo > toLocalDateString()) {
      Alert.alert('Invalid range', 'Profitability cannot include future dates.');
      return;
    }
    setAppliedCustomRange({ from: customFrom, to: customTo });
  };

  useEffect(() => { void load(); }, [load]);
  return {
    ...businessDate, dateFrom, dateTo, range, setRange, report, loading, load,
    customFrom, setCustomFrom, customTo, setCustomTo, applyCustomRange,
  };
}
