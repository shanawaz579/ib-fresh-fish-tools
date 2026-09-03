import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { getPaymentRegister } from '../../api/paymentRegister';
import { calculatePaymentRegisterTotals, type PaymentDirection, type PaymentRegisterEntry, type RegisterPaymentMethod } from '../../domain/paymentRegister';
import { useBusinessDate } from '../../hooks/useBusinessDate';

export type DirectionFilter = 'all' | PaymentDirection;
export type MethodFilter = 'all' | RegisterPaymentMethod;

export function usePaymentRegister() {
  const businessDate = useBusinessDate();
  const [entries, setEntries] = useState<PaymentRegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [direction, setDirection] = useState<DirectionFilter>('all');
  const [method, setMethod] = useState<MethodFilter>('all');
  const [search, setSearch] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setEntries(await getPaymentRegister(businessDate.date));
    } catch (error) {
      console.error('Unable to load payment register:', error);
      Alert.alert('Unable to load payments', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [businessDate.date]);

  useEffect(() => { void load(); }, [load]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter(entry =>
      (includeVoided || !entry.voidedAt)
      && (direction === 'all' || entry.direction === direction)
      && (method === 'all' || entry.method === method)
      && (!query || [entry.partyName, entry.billNumber, entry.referenceNumber]
        .some(value => value?.toLowerCase().includes(query))),
    );
  }, [direction, entries, includeVoided, method, search]);

  return {
    ...businessDate,
    entries,
    visibleEntries,
    totals: calculatePaymentRegisterTotals(visibleEntries),
    loading,
    refreshing,
    refresh: () => load(true),
    direction,
    setDirection,
    method,
    setMethod,
    search,
    setSearch,
    includeVoided,
    setIncludeVoided,
  };
}
