/**
 * Hide-on-scroll math for chrome that follows the finger (Facebook style). "Offset" is how many px of the chrome
 * are hidden (0 = fully shown, max = fully hidden); y is the list's scroll offset.
 */

/** Tracking state: hidden px, plus the upward travel collected against the backlash while fully hidden. */
export interface ChromeTrack {
  offset: number;
  slack: number;
}

/**
 * New tracking state after the list moved from prevY to y. Scrolling down hides 1:1. Once fully hidden, the
 * chrome ignores the first `backlash` px of upward travel (so reading back a little doesn't pop it in), then
 * reveals 1:1; a partly shown chrome reveals immediately. Near the top it never hides more than was scrolled.
 */
export function trackChrome(state: ChromeTrack, prevY: number, y: number, max: number, backlash: number): ChromeTrack {
  const dy = y - prevY;
  let { offset, slack } = state;

  if (dy > 0) {
    slack = 0;
    offset += dy;
  } else if (dy < 0) {
    let up = -dy;
    if (offset >= max && slack < backlash) {
      const absorbed = Math.min(up, backlash - slack);
      slack += absorbed;
      up -= absorbed;
    }
    offset -= up;
  }

  const limit = Math.min(max, Math.max(y, 0));
  if (offset > limit) {
    offset = limit;
    if (y < max) slack = 0;
  }
  return { offset: Math.max(0, offset), slack };
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
