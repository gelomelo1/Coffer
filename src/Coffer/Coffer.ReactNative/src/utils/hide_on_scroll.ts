/**
 * Hide-on-scroll math for chrome that follows the finger (Facebook style). "Offset" is how many px of the chrome
 * are hidden (0 = fully shown, max = fully hidden); y is the list's scroll offset.
 */

/** New hidden offset after the list moved from prevY to y. Never hides more than has been scrolled from the top. */
export function trackOffset(prevOffset: number, prevY: number, y: number, max: number): number {
  const limit = Math.min(max, Math.max(y, 0));
  return Math.min(limit, Math.max(0, prevOffset + (y - prevY)));
}

/**
 * Where a released, possibly half-hidden chrome settles: fully shown (0) or fully hidden (max). Like Facebook, a
 * partly hidden chrome follows the last scroll direction (any scroll up reveals it); without one, the nearest wins.
 */
export function snapOffset(offset: number, y: number, max: number, direction: -1 | 0 | 1 = 0): number {
  if (y < max || offset <= 0) return 0;
  if (offset >= max) return max;
  if (direction < 0) return 0;
  if (direction > 0) return max;
  return offset < max / 2 ? 0 : max;
}
