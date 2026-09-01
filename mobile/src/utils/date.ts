const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(date: string): Date {
  const match = DATE_ONLY_PATTERN.exec(date);
  if (!match) throw new Error(`Invalid date-only value: ${date}`);

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

export function addDays(date: string, days: number): string {
  const nextDate = parseLocalDate(date);
  nextDate.setDate(nextDate.getDate() + days);
  return toLocalDateString(nextDate);
}

export function formatBusinessDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
