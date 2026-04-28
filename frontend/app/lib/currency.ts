export type CurrencyCode = "USD" | "EUR" | "TRY" | "GBP" | "JPY" | "CAD" | "AUD" | "CHF" | "RUB" | "CNY";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  TRY: "₺",
  GBP: "£",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  CHF: "CHF",
  RUB: "₽",
  CNY: "¥",
};

export const CURRENCY_LABELS: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  TRY: "Turkish Lira",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  CHF: "Swiss Franc",
  RUB: "Russian Ruble",
  CNY: "Chinese Yuan",
};

export const FALLBACK_USD_BASE_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.93,
  TRY: 32.50, // Updated to a more recent-ish value or just matching tools if it had it
  GBP: 0.8,
  JPY: 154.2,
  CAD: 1.37,
  AUD: 1.52,
  CHF: 0.91,
  RUB: 92.5,
  CNY: 7.24,
};

export const CURRENCIES = Object.keys(CURRENCY_LABELS) as CurrencyCode[];

export const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price";

export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number>
): number {
  if (!Number.isFinite(amount)) return 0;
  const fromRate = rates[from] || FALLBACK_USD_BASE_RATES[from] || 1;
  const toRate = rates[to] || FALLBACK_USD_BASE_RATES[to] || 1;
  const amountInUsd = amount / fromRate;
  return amountInUsd * toRate;
}

export function getUsdtPerCurrency(
  currency: string,
  tickerBySymbol: Record<string, number>
): number | null {
  if (currency === "USD" || currency === "USDT") return 1;

  const direct = tickerBySymbol[`${currency}USDT`];
  if (direct && direct > 0) return direct;

  const inverse = tickerBySymbol[`USDT${currency}`];
  if (inverse && inverse > 0) return 1 / inverse;

  return FALLBACK_USD_BASE_RATES[currency] ? 1 / FALLBACK_USD_BASE_RATES[currency] : null;
}

export function formatCurrency(
  value: number | null | undefined,
  currency: string = "USD"
): string {
  if (!Number.isFinite(value ?? NaN)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: (value ?? 0) >= 1 ? 2 : 6,
  }).format(value as number)
}

export function formatCompactCurrency(
  value: number | null | undefined,
  currency: string = "USD"
): string {
  if (!Number.isFinite(value ?? NaN)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value as number)
}
