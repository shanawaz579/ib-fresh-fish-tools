import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  getHarvestForecast,
  type HarvestForecastRow,
  saveHarvestForecastQuantity,
} from '../../api/forecast';
import { addDays, toLocalDateString } from '../../utils/date';

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Please check the connection and try again.';
}

export function useHarvestForecast() {
  const [startDate, setStartDate] = useState(addDays(toLocalDateString(), 1));
  const [rows, setRows] = useState<HarvestForecastRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const result = await getHarvestForecast(startDate, refresh);
      setRows(result);
      setDrafts(Object.fromEntries(result.map((row) => [row.id, String(row.final_crates)])));
    } catch (error) {
      console.error('Unable to generate harvest forecast:', error);
      Alert.alert('Unable to prepare forecast', errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => { void load(); }, [load]);

  const changedRows = useMemo(() => rows.filter((row) => {
    const value = Number(drafts[row.id]);
    return Number.isInteger(value) && value >= 0 && value !== row.final_crates;
  }), [drafts, rows]);

  const save = async () => {
    const hasInvalid = rows.some((row) => {
      const value = Number(drafts[row.id]);
      return !Number.isInteger(value) || value < 0;
    });
    if (hasInvalid) {
      Alert.alert('Check quantities', 'Enter whole crate quantities of zero or more.');
      return;
    }
    if (!changedRows.length) return;
    setSaving(true);
    try {
      await Promise.all(changedRows.map((row) => saveHarvestForecastQuantity(row.id, Number(drafts[row.id]))));
      await load(false);
      Alert.alert('Plan saved', 'Your harvest quantities were updated.');
    } catch (error) {
      console.error('Unable to save harvest forecast:', error);
      Alert.alert('Unable to save plan', errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return {
    startDate,
    rows,
    drafts,
    loading,
    saving,
    hasChanges: changedRows.length > 0,
    previousWeek: () => setStartDate((date) => addDays(date, -7)),
    nextWeek: () => setStartDate((date) => addDays(date, 7)),
    resetToNextWeek: () => setStartDate(addDays(toLocalDateString(), 1)),
    updateDraft: (id: number, value: string) => setDrafts((current) => ({ ...current, [id]: value.replace(/[^0-9]/g, '').slice(0, 4) })),
    load,
    refresh: () => load(true),
    save,
  };
}
