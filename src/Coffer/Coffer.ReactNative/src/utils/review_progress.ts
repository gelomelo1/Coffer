/**
 * Caps still to review, for the "3 / 14" counter. Only caps acted on that the server still lists are subtracted:
 * once an action is sent the list reloads without the cap, and it must not be subtracted a second time.
 */
export function remainingCount(total: number, loadedIds: string[], hidden: Set<string>): number {
  const stillListed = loadedIds.filter((id) => hidden.has(id)).length;
  return Math.max(0, total - stillListed);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left until a waiting item is removed, rounded up and at least 1 ("in 1 day", never "in 0 days"). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - now.getTime()) / DAY_MS));
}
