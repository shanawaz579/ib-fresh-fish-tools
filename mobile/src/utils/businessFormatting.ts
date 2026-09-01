import type { BusinessPreferences } from '../types';

export function formatConfiguredMoney(
  amount: number,
  preferences: BusinessPreferences,
  fractionDigits = 2,
): string {
  try {
    return new Intl.NumberFormat(preferences.locale, {
      style: 'currency',
      currency: preferences.currency_code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${preferences.currency_symbol}${amount.toFixed(fractionDigits)}`;
  }
}

export function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
