import { useCallback, useState } from 'react';
import { addDays, toLocalDateString } from '../utils/date';

export function useBusinessDate(initialDate?: string) {
  const [date, setDate] = useState(initialDate ?? toLocalDateString());

  const goToPreviousDay = useCallback(() => setDate(current => addDays(current, -1)), []);
  const goToNextDay = useCallback(() => setDate(current => addDays(current, 1)), []);
  const goToToday = useCallback(() => setDate(toLocalDateString()), []);

  return { date, setDate, goToPreviousDay, goToNextDay, goToToday };
}
