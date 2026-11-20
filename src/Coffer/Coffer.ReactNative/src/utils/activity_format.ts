/**
 * Pure helpers for My activity (no React Native imports, so node tests can run them): day sections and the values
 * an entry's sentence needs. Structural types keep this file free of app enums.
 */

export interface ActivityTargetLike {
  type: string;
  title: string;
  available: boolean;
  otherName?: string | null;
}

export interface ActivityEntryLike {
  kind: string;
  occurredAt: string;
  details: Record<string, unknown>;
  target: ActivityTargetLike;
}

export interface DayLabels {
  today: string;
  yesterday: string;
  /** Header for older days, e.g. "Mon, 17 Nov". */
  date: (day: Date) => string;
}

export interface DaySection<T> {
  key: string;
  title: string;
  data: T[];
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Splits a newest-first list into local-day sections: "Today", "Yesterday", then dates. */
export function groupByDay<T extends { occurredAt: string }>(entries: T[], now: Date, labels: DayLabels): DaySection<T>[] {
  const today = dayKey(now);
  const before = new Date(now);
  before.setDate(before.getDate() - 1);
  const yesterday = dayKey(before);

  const sections: DaySection<T>[] = [];
  for (const entry of entries) {
    const at = new Date(entry.occurredAt);
    const key = dayKey(at);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      section = { key, title: key === today ? labels.today : key === yesterday ? labels.yesterday : labels.date(at), data: [] };
      sections.push(section);
    }
    section.data.push(entry);
  }
  return sections;
}

export interface SentenceDeps {
  /** Shown for a target that is gone. */
  unavailable: string;
  /** Shown for a target that exists but has no name (an item without a primary value). */
  untitled: string;
  money: (cents: number) => string;
  /** Translates a short term, e.g. "proposal.offer" → "a price offer". */
  term: (key: string) => string;
}

const stars = (value: number) => `${value}★`; // i18n-ignore (a rating, not copy)

/**
 * The interpolation values for activity:kinds.<kind>. A gone target sets context "gone", which picks the
 * kinds.<kind>_gone sentence: it names no thing and no person (a deleted account's name must not appear).
 */
export function sentenceParams(entry: ActivityEntryLike, deps: SentenceDeps): Record<string, string | number> {
  const { target, details } = entry;
  const params: Record<string, string | number> = {
    name: target.available ? target.title || deps.untitled : deps.unavailable,
    other: target.available ? (target.otherName ?? "") : "",
  };
  if (!target.available) params.context = "gone";

  for (const key of ["stars", "from", "to"] as const) {
    if (typeof details[key] === "number") params[key] = stars(details[key] as number);
  }
  if (typeof details.quantity === "number") params.quantity = details.quantity;
  if (typeof details.priceCents === "number") params.price = deps.money(details.priceCents);
  if (typeof details.proposal === "string") params.what = deps.term(`proposal.${details.proposal}`);
  return params;
}

/**
 * Cache keys carry the signed-in user: the cache outlives a logout, and the next account on the device must never
 * be shown the previous one's log, not even while its own loads.
 */
export const activityListKey = (userId: string | null | undefined, category: string | null) => ["activity", userId ?? "", category ?? "all"];
export const activitySummaryKey = (userId: string | null | undefined) => ["activitySummary", userId ?? ""];
