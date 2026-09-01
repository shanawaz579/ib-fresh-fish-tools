import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { getProfitabilityReport } from '../../api/profitability';
import { useBusinessDate } from '../../hooks/useBusinessDate';
import type { ProfitabilityReport } from '../../types';
import { addDays } from '../../utils/date';

export type ProfitabilityRange = 'today' | 'seven_days' | 'month';

function messageFromError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Please check the connection and try again.';
}

export function useProfitability() {
  const businessDate = useBusinessDate();
  const [range, setRange] = useState<ProfitabilityRange>('today');
  const [report, setReport] = useState<ProfitabilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const dateFrom = useMemo(() => {
    if (range === 'seven_days') return addDays(businessDate.date, -6);
    if (range === 'month') return `${businessDate.date.slice(0, 8)}01`;
    return businessDate.date;
  }, [businessDate.date, range]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await getProfitabilityReport(dateFrom, businessDate.date));
    } catch (error) {
      console.error('Unable to load profitability:', error);
      Alert.alert('Unable to load profitability', messageFromError(error));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [businessDate.date, dateFrom]);

  useEffect(() => { void load(); }, [load]);
  return { ...businessDate, dateFrom, range, setRange, report, loading, load };
}
