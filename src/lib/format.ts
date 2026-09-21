import type { CountryRules } from "./countries";

/**
 * Formats an amount with our own currency symbol rather than Intl's
 * currency style — CLDR renders SGD's symbol as a bare "$" in English
 * locales, indistinguishable from USD, so we prefix `rules.currencySymbol`
 * ("RM" / "S$") ourselves and only use Intl for digit grouping.
 */
export function formatMoney(amount: number, rules: Pick<CountryRules, "currencySymbol" | "locale">): string {
  const grouped = new Intl.NumberFormat(rules.locale, { maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
  return `${rules.currencySymbol} ${grouped}`;
}

export function formatTenure(months: number): string {
  return months === 1 ? "1 month" : `${months} months`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}
