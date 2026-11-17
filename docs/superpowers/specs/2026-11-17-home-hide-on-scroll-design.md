# Home feed — Facebook-style hide-on-scroll chrome

## Intent
While reading the home feed, the app chrome gets out of the way: scrolling down slides the top header and the
search/filter bar up, and the bottom tab bar and the "+" (add item) button down, until the feed has the whole
screen. Any scroll up brings them back. Same feel as the Facebook app.

## Goals
- Top chrome (AppHeader + search/filter toolbar) moves up 1:1 with the finger; bottom tab bar and "+" move down
  in step (same progress, each over its own distance) — the "+" ends fully off-screen.
- On release (end of drag without fling, or end of momentum) a half-hidden state snaps to fully shown or fully
  hidden (nearest), so nothing stays half-way.
- Bars are always shown: at the top of the feed (scroll offset smaller than the chrome height), on pull-to-refresh,
  when the search sheet or the type filter opens, when Home loses focus (tab switch, pushed screen), and whenever a
  screen reader is on.
- Reduced motion: tracking stays (direct manipulation); snaps jump instead of animating.

## Non-goals
- Other tabs keep fixed chrome. No change to header/tab bar look.

## Approaches
1. **Finger-tracking + snap (picked by the user).** Scroll events drive a hide progress (0–1); transforms render
   from one `Animated.Value`, snap uses `Animated.timing` with the native driver.
2. Direction-triggered slide (~24 dp threshold, ~200 ms animation) — simpler, less glued to the finger. Not picked.

## Design
- **Pure logic** `src/utils/hide_on_scroll.ts` (unit-tested):
  `trackOffset(prevOffset, prevY, y, max)` → new hidden offset in px: clamp(prev + (y − prevY), 0, min(max, y));
  `y ≤ 0` → 0. `snapOffset(offset, y, max)` → `0` or `max` (nearest; `0` when `y < max`).
- **Shared state** `src/hooks/home_chrome.ts`: one module-level `Animated.Value` `progress` (0 shown … 1 hidden) plus
  `showHomeChrome(animated)` / `setHomeChromeProgress(p)` and `useHomeChromeLocked()` (screen reader ⇒ locked shown).
- **Home screen**: `headerShown: false` for the `index` tab; `feed_list.tsx` renders an absolutely positioned
  `Animated.View` holding `TabsHeader` + the toolbar (no longer a sticky list row), translateY
  `progress → [0, −topHeight]` (height measured with onLayout). The FlatList gets `paddingTop = topHeight`,
  `paddingBottom += tab bar height`, `progressViewOffset = topHeight`, `onScroll` (scrollEventThrottle 16) feeding
  `trackOffset`, `onScrollEndDrag`/`onMomentumScrollEnd` feeding `snapOffset`.
- **Tab bar** (index route only): `tabBarStyle` gets `position: "absolute"` + translateY `progress → [0, barHeight]`.
- **"+" button**: translateY `progress → [0, bottom + size + shadow]` (fully off-screen); hidden from accessibility
  and touch while progress > 0.5.
- No new dependency (RN `Animated`; reanimated is not installed).

## Revision (2026-11-17, user feedback)
- Hiding also fades: the top chrome and the tab bar go from opacity 1 to 0 as they slide; the "+" no longer leaves
  the screen — it floats down only 24 dp while fading out (gone by 80 % progress).
- Backlash: a fully hidden chrome ignores the first 200 dp (≈ one thumb scroll) of upward travel, then reveals 1:1;
  a partly shown chrome still reveals at once. `trackChrome(state, prevY, y, max, backlash)` replaces `trackOffset`.
- Release snaps follow the last scroll direction (any scroll up reveals a partly hidden chrome), nearest otherwise.
- Hero restored to its pre-redesign role: fixed behind the feed (reaching up behind the chrome), text fades and the
  image dims as the cards' cream sheet scrolls up over it.
- Snaps run on the JS driver: a native-owned value stopped updating the tab bar after a tab switch.

## Left to the builder
Exact snap duration (≈200 ms, decelerate), velocity tie-breaks, StatusBar background while the header is hidden
(cream band behind the status bar stays so status icons remain readable).
