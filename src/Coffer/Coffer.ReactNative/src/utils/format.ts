/**
 * Locale-aware number and money formatting (decimal separator, grouping, currency position). Pure — the locale is
 * passed in (callers use i18n.language) — so it can be unit tested with node.
 */

/** Euro cents as money: "€1.50" (en), "1,50 €" (hu); whole amounts without decimals. */
export function formatMoney(cents: number, locale: string, currency = "EUR"): string {
  const whole = cents % 100 === 0;
  const text = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    // "€" in every language (Hungarian ICU data would otherwise print "EUR").
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
  return withCurrencySymbol(text, currency);
}

const SYMBOLS: Record<string, string> = { EUR: "€" };

/**
 * Hermes (the app's JS engine) ignores currencyDisplay "narrowSymbol" for some locales and prints the code
 * ("1 234,50 EUR"); swap the code for the symbol, without a gap when it comes before the number ("€1.50").
 */
export function withCurrencySymbol(text: string, currency: string): string {
  const symbol = SYMBOLS[currency];
  if (!symbol || !text.includes(currency)) return text;
  return text.replace(new RegExp(`${currency}[\\s\\u00a0\\u202f]*(?=[-\\d])`), symbol).replace(currency, symbol);
}

/** A number with a fixed count of decimals: 4.5 → "4.5" (en), "4,5" (hu). */
export function formatDecimal(value: number, locale: string, fractionDigits: number): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value);
}

/** Cents as an editable amount (no currency, no grouping): 150 → "1,50" (hu); whole amounts without decimals. */
export function formatAmountInput(cents: number, locale: string): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

const SHORT_SUFFIXES: Record<string, { thousand: string; million: string; billion: string; space: boolean }> = {
  en: { thousand: "k", million: "M", billion: "B", space: false },
  hu: { thousand: "E", million: "M", billion: "Mrd", space: true },
};

/** Big counts shortened (rounded down to 2 decimals): 1530 → "1.53k" (en), "1,53 E" (hu). */
export function formatNumberShort(num: number, locale: string): string {
  const s = SHORT_SUFFIXES[locale.split("-")[0]] ?? SHORT_SUFFIXES.en;
  const short = (value: number, suffix: string) => {
    const truncated = Math.floor(value * 100) / 100;
    const text = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(truncated);
    return s.space ? `${text} ${suffix}` : `${text}${suffix}`;
  };
  if (num >= 1_000_000_000) return short(num / 1_000_000_000, s.billion);
  if (num >= 1_000_000) return short(num / 1_000_000, s.million);
  if (num >= 1_000) return short(num / 1_000, s.thousand);
  return String(num);
}
