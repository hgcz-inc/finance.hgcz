export type Currency = 'VND' | 'NZD';
export const CURRENCY_STORAGE_KEY = 'currency';

export function normalizeCurrency(value: unknown): Currency {
  if (
    value === 1 ||
    value === '1' ||
    (typeof value === 'string' && value.toUpperCase() === 'NZD')
  ) {
    return 'NZD';
  }

  return 'VND';
}

export function currencyToDb(value: Currency): number {
  return value === 'NZD' ? 1 : 0;
}

function localeFor(currency: Currency): string {
  return currency === 'NZD' ? 'en-NZ' : 'vi-VN';
}

export function formatMoney(
  value: number | null | undefined,
  currency: Currency
): string {
  return new Intl.NumberFormat(localeFor(currency), {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'NZD' ? 2 : 0,
  }).format(Number(value ?? 0));
}

export function formatCompactMoney(
  value: number | null | undefined,
  currency: Currency
): string {
  return new Intl.NumberFormat(localeFor(currency), {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value ?? 0));
}
