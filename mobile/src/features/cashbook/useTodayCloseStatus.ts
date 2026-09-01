import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getDayCloseReadiness } from '../../api/cashbook';
import type { DayCloseReadiness } from '../../types';
import { toLocalDateString } from '../../utils/date';

export function useTodayCloseStatus() {
  const [readiness, setReadiness] = useState<DayCloseReadiness | null>(null);

  const load = useCallback(async () => {
    try {
      setReadiness(await getDayCloseReadiness(toLocalDateString()));
    } catch (error) {
      console.warn('Unable to load today close status:', error);
      setReadiness(null);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return readiness;
}
