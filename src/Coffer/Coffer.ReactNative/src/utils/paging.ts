/**
 * Paged lists: the backend answers { items, page, pageSize, total } (grouped lists add groupCounts) and the app appends
 * pages as the user scrolls to the end. Pure, so it can be unit tested with node.
 */
export const PAGE_SIZE = 20;

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** A page of a list ordered by collection type first; groupCounts = total per type id. */
export interface GroupedPaged<T> extends Paged<T> {
  groupCounts: Record<string, number>;
}

/** A page of a chat (oldest → newest). Older pages are asked for with before = the oldest loaded message's time. */
export interface MessagePage<T> {
  items: T[];
  hasMore: boolean;
  total: number;
}

export function nextPageParam(last: Paged<unknown>): number | undefined {
  return last.page * last.pageSize < last.total ? last.page + 1 : undefined;
}

/** Appended pages as one list. New rows can shift offsets between requests, so a row seen already is skipped. */
export function mergePages<T>(pages: Paged<T>[], idOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of pages)
    for (const item of p.items) {
      const id = idOf(item);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  return out;
}

/** Chat pages arrive newest first; the chat shows the oldest message first. */
export function mergeMessagePages<T extends { id: string }>(pages: MessagePage<T>[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of [...pages].reverse())
    for (const m of p.items) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  return out;
}

/** Groups in the order the backend sent them (it sorts by group first). */
export function groupInOrder<T>(items: T[], groupOf: (item: T) => number): { id: number; items: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const id = groupOf(item);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(item);
  }
  return [...groups.entries()].map(([id, groupItems]) => ({ id, items: groupItems }));
}

/**
 * Collapsible groups (my follows): an expanded group keeps pulling pages until it shows its first page worth of
 * entries (or all of them); after that, scrolling to its end loads more as usual.
 */
export function prefetchForExpandedGroup(
  expanded: number[],
  loaded: Record<number, number>,
  groupCounts: Record<string, number>,
  pageSize = PAGE_SIZE,
): boolean {
  return expanded.some((id) => {
    const have = loaded[id] ?? 0;
    const all = groupCounts[String(id)] ?? 0;
    return have < Math.min(all, pageSize);
  });
}

/** For plain ScrollViews: is the bottom within `threshold` px? */
export function isNearEnd(
  e: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } },
  threshold: number,
): boolean {
  return e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - threshold;
}
