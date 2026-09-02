export type Currency = 'VND' | 'NZD';

export function normalizeCurrency(value: unknown): Currency {
  return value === 'NZD' ? 'NZD' : 'VND';
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
    minimumFractionDigits: currency === 'NZD' ? 2 : 0,
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
