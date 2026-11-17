# Home Hide-on-Scroll Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Home tab, header + search/filter bar slide up and tab bar + "+" slide down with the scroll (Facebook style), snapping fully shown/hidden on release.

**Architecture:** Pure tracking/snap math in `utils/hide_on_scroll.ts`; one module-level `Animated.Value` (`progress` 0–1) in `hooks/home_chrome.ts` drives three transforms (top chrome layer in `feed_list.tsx`, tab bar via `tabBarStyle`, FAB). Scroll events update the value with `setValue` (no React re-render); snaps use `Animated.timing` with the native driver.

**Tech Stack:** React Native 0.81 `Animated`, expo-router Tabs (@react-navigation/bottom-tabs 7.8), node:test.

**Spec:** `docs/superpowers/specs/2026-11-17-home-hide-on-scroll-design.md`

## Global Constraints
- No new dependencies. Home tab only; other tabs unchanged.
- All new copy through i18n (none expected). Tokens from `src/theme/theme.ts`.
- Status-bar band (insets.top, cream) stays fixed; only the header body + toolbar move (distance = layer height − insets.top).
- Reduced motion ⇒ snaps are instant; screen reader on ⇒ chrome locked shown.

## Review Focus
1. Pull-to-refresh at the top — spinner visible below the chrome, chrome shown.
2. Fast fling then tap a tab — chrome and FAB restored on every tab.
3. Short feed (fewer posts than one screen) — chrome never hides.
4. Opening search sheet / type filter while hidden — chrome comes back.
5. Hidden FAB/tab bar cannot be tapped or focused.

---

### Task 1: Tracking + snap math

**Files:** Create `src/utils/hide_on_scroll.ts`; Test `tests/hide_on_scroll.test.ts`

**Interfaces — Produces:**
- `trackOffset(prevOffset: number, prevY: number, y: number, max: number): number` — clamp(prevOffset + (y − prevY), 0, min(max, max(y, 0))).
- `snapOffset(offset: number, y: number, max: number): number` — `0` if `y < max` or `offset < max / 2`, else `max`.

- [ ] Step 1: tests — `trackOffset(0,0,30,100)===30`; `trackOffset(90,500,540,100)===100`; `trackOffset(60,500,470,100)===30`; `trackOffset(50,100,-20,100)===0`; `trackOffset(80,300,40,100)===40` (near top: never hide more than scrolled); `snapOffset(49,500,100)===0`; `snapOffset(50,500,100)===100`; `snapOffset(90,60,100)===0`.
- [ ] Step 2: run `node --test tests/hide_on_scroll.test.ts` → FAIL (module missing).
- [ ] Step 3: implement.
- [ ] Step 4: run → PASS; `npm run test:unit` → all pass.

### Task 2: Shared chrome state + wiring

**Files:** Create `src/hooks/home_chrome.ts`; Modify `src/components/collections/tabs/layout/collection_tabs_custom_layout.tsx`, `src/components/itemregister/item_register_action_button_tabs.tsx`, `src/components/custom_ui/fab.tsx`, `src/components/collections/tabs/home/feed_list.tsx`

**Interfaces — Produces:**
- `homeChromeProgress: Animated.Value` (0 shown … 1 hidden)
- `showHomeChrome(): void` (animated unless reduce-motion), `setHomeChromeProgress(p: number): void`
- `useHomeChromeLocked(): boolean` (screen reader enabled)
- `useHomeChromeHidden(): boolean` (progress > 0.5, via listener, for pointerEvents/accessibility)
- `TabsHeader` exported from `collection_tabs_custom_layout.tsx`; options for route `index`: `headerShown: false`, `tabBarStyle` + `position: "absolute"`, `transform: [{ translateY: progress→[0, barHeight] }]`.
- `RetroFab` accepts `style?: StyleProp<ViewStyle>` (Animated wrapper) and `hidden?: boolean`.

- [ ] Step 1: `home_chrome.ts` with the value, reduce-motion/screen-reader listeners (AccessibilityInfo).
- [ ] Step 2: tab layout — Home route absolute + animated tab bar, no navigator header; export `TabsHeader`.
- [ ] Step 3: FAB — wrap in `Animated.View` translateY `progress→[0, bottom + 56 + 8]`; hidden ⇒ `pointerEvents="none"`, `importantForAccessibility="no-hide-descendants"`, `accessibilityElementsHidden`.
- [ ] Step 4: feed list — remove sticky toolbar row; absolute top layer (cream status band fixed + `Animated.View` with `TabsHeader` + toolbar, translateY `progress→[0, −(layerHeight − insets.top)]`), measured `onLayout`; FlatList `paddingTop = layerHeight`, `paddingBottom += barHeight`, `RefreshControl progressViewOffset = layerHeight`, `onScroll`/`onScrollEndDrag`/`onMomentumScrollEnd` using Task 1; `useFocusEffect` blur ⇒ `showHomeChrome()`; opening search/filter ⇒ show; locked ⇒ no tracking.
- [ ] Step 5: `npx tsc --noEmit` → 0 errors; `npm run check:i18n` → pass; `npm run test:unit` → pass.
- [ ] Step 6: device: Pixel 7 — slow scroll tracks, release snaps, scroll up reveals, pull-to-refresh, tab switch restores, search opens with chrome shown, short feed; 320dp/1.3; TalkBack-free check of locked path via code review.
- [ ] Step 7: commit `feat(ui): Facebook-style hide-on-scroll chrome on the home feed`.
