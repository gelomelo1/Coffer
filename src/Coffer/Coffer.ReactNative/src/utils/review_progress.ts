/**
 * Caps still to review, for the "3 / 14" counter. Only caps acted on that the server still lists are subtracted:
 * once an action is sent the list reloads without the cap, and it must not be subtracted a second time.
 */
export function remainingCount(total: number, loadedIds: string[], hidden: Set<string>): number {
  const stillListed = loadedIds.filter((id) => hidden.has(id)).length;
  return Math.max(0, total - stillListed);
}
