/**
 * Texts and placeholder values the backend sends language-neutrally:
 *   "@t:<namespace:key>"  → a translation (e.g. "@t:market:delivery.shipping")
 *   "@eur:<cents>"        → a money amount in the app language's format
 * Anything else is shown as written (user text, tracking numbers, names). Pure; the translate and money functions
 * are passed in so it can be unit tested with node.
 */
type Translate = (key: string) => string;
type Money = (cents: number) => string;

export function resolveText<T extends string | null | undefined>(value: T, translate: Translate, money: Money): T | string {
  if (typeof value !== "string") return value;
  if (value.startsWith("@t:")) return translate(value.slice(3));
  if (value.startsWith("@eur:")) {
    const cents = Number(value.slice(5));
    return Number.isFinite(cents) && value.length > 5 ? money(cents) : value;
  }
  return value;
}

export function resolveTextParams(
  params: Record<string, string> | null | undefined,
  translate: Translate,
  money: Money,
): Record<string, string> | undefined {
  if (!params) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) out[k] = resolveText(v, translate, money) as string;
  return out;
}
