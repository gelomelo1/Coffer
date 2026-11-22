# Community Tab and Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Community bottom tab with three full-height tiles (News, Stats & facts, Shape What's Next) and a Stats & facts page: totals, weekly/monthly interactions, growth graph, collector of the week, trending item type, and two laddered weekly milestones with the user's own contribution.

**Architecture:** One read-only endpoint `GET api/Community/Stats` computed from existing dated data (users, collections, items, activity log) by `CommunityStatsService`; the shared part is cached 5 minutes in `IMemoryCache`, the user's part is computed per request. Milestone targets come from replaying every week since the first activity through a fixed ladder (pure `MilestoneLadder`). The app adds the tab, tiles, two "coming soon" pages and the stats page (react-native-svg chart, pure format helpers tested with node).

**Tech Stack:** ASP.NET Core 8, EF Core, xUnit; Expo / React Native, react-query, react-native-svg, i18next (en + hu), node:test.

**Spec:** `docs/superpowers/specs/2026-11-22-community-tab-design.md`

## Global Constraints

- Weeks: Monday 00:00 – Sunday 24:00 UTC; "this month" = calendar month UTC.
- Counted: only published item types, live (not tombstoned) rows, users not deleted (use `PublishedTypes.WherePublished` and `DeletedAt == null`).
- Ladders (exact): items added per week `10,15,25,40,60,90,130,180,250,350,500,700,1000,1500,2000,3000,5000`; active users per week `3,5,8,12,18,25,35,50,75,100,150,200,300,500,750,1000`. Replay starts on rung index 0 in the first week with any activity; met → +1 (cap), missed → −1 (floor 0); silent weeks are missed weeks.
- Interactions kinds: `reaction.liked`, `reaction.rated`, `comment.posted`, `comment.replied`, `follow.followed`. Items added = `item.added` (1) + `item.addedToExisting` (details.quantity, default 1).
- Collector of the week: most activity entries this week; ties → more items added this week, then earlier latest entry; skip deleted and currently suspended users.
- Cache: shared part 5 minutes (`IMemoryCache`, key `community-stats`); `mine` never cached.
- Endpoint requires a signed-in app user (`[Authorize]`, `MarketplaceControllerBase`).
- App: 4th tab "Community"/"Közösség", icon `account-group`; FAB hidden on it; tiles fill the space (`flex: 1` each, gap 12, padding 16); count-up skipped with reduced motion; en + hu; `check:i18n`, `check:errors`, `tsc`, unit tests pass.
- Git: no branches, no pushes, no Co-authored-by trailers. Backend tests `"/c/Program Files/dotnet/dotnet.exe" test src/Coffer/Coffer.Tests`; app `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n`, `npm run check:errors`.

## Review Focus

1. **Empty or brand-new database** — expected: zeros, null highlights, milestones on rung 0 with progress 0, no crash. Test `EmptyDatabaseGivesZerosAndRungZero` (Task 2).
2. **Silent weeks between active weeks** — expected: each counts as a missed week (target steps down). Test `SilentWeeksAreMissedWeeks` (Task 1).
3. **Week boundary** — an entry at Sunday 23:59:59 UTC belongs to the old week, Monday 00:00 to the new. Test `WeekStartsMondayUtc` (Task 1).
4. **Hidden and deleted things** — items of unpublished types, tombstoned items/collections, deleted accounts never counted; suspended user never collector of the week. Tests `HiddenAndDeletedAreNotCounted`, `SuspendedUserIsNotCollectorOfTheWeek` (Task 2).
5. **Cache vs. personal part** — a second user within 5 minutes gets the cached shared numbers but their own `mine`. Test `MineIsPerUserWhileSharedPartIsCached` (Task 2).

---

### Task 1: Weeks and milestone ladder (pure)

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Community/Stats/MilestoneLadder.cs`
- Test: `src/Coffer/Coffer.Tests/Community/MilestoneLadderTests.cs`

**Interfaces:**
- Produces:
  ```csharp
  public static class Weeks {
      public static DateTime StartOf(DateTime utc);          // Monday 00:00 UTC of that week
      public static DateTime MonthStartOf(DateTime utc);     // 1st 00:00 UTC
  }
  public sealed record LadderState(int Rung, int Streak, int BestRung);   // Streak = met weeks in a row ending last week
  public static class MilestoneLadder {
      public static readonly int[] ItemsAdded = { 10,15,25,40,60,90,130,180,250,350,500,700,1000,1500,2000,3000,5000 };
      public static readonly int[] ActiveUsers = { 3,5,8,12,18,25,35,50,75,100,150,200,300,500,750,1000 };
      /// completedWeeks: counts of every completed week, oldest first, starting with the first week that had activity.
      public static LadderState Replay(IReadOnlyList<int> completedWeeks, int[] rungs);
  }
  ```

- [ ] **Step 1: Failing tests** — `WeekStartsMondayUtc` (Sun 2026-11-22 23:59:59Z → 2026-11-16; Mon 2026-11-23 00:00Z → 2026-11-23; `MonthStartOf`), `NoHistoryStartsOnFirstRung` (→ Rung 0, Streak 0, Best 0), `MetWeeksClimbOneRungEach` ([10,15,25] items → Rung 3, Streak 3, Best 3), `MissedWeekStepsBackToTheSameValue` ([10,15,3] → Rung 1, target 15 again, Streak 0, Best 2), `SilentWeeksAreMissedWeeks` ([12,0,0,0] → Rung 0), `LadderIsCappedAtTheTop` (30 met weeks → last rung), `NeverBelowFirstRung`.
- [ ] **Step 2: Run** `dotnet test --filter FullyQualifiedName~MilestoneLadderTests` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): weekly milestone ladder`

### Task 2: Community stats endpoint

**Files:**
- Create: `src/Coffer/Coffer.BusinessLogic/Community/Stats/CommunityStatsService.cs`, `src/Coffer/Coffer.ASPNET/Controllers/CommunityController.cs`
- Modify: DI registration (`ModerationRegistration.cs` next to the activity services)
- Test: `src/Coffer/Coffer.Tests/Community/CommunityStatsTests.cs` (service level on `TestDb` + `FakeClock` + `MemoryCache`), one API test in the same file for auth and JSON shape

**Interfaces:**
- Consumes: `Weeks`, `MilestoneLadder`, `PublishedTypes`, `ActivityEvent`.
- Produces:
  ```csharp
  public sealed record StatsTotals(int Members, int Items, int Pieces, int Collections, int Interactions);
  public sealed record PeriodCounts(int ThisWeek, int ThisMonth);
  public sealed record GrowthPoint(DateTime WeekStart, int Members, int Items, int Collections);   // cumulative at week end
  public sealed record TopCollectorDto(Guid UserId, string Name, string? Avatar, int ActivityCount);
  public sealed record TrendingTypeDto(int Id, string Name, string Color, string Icon, int ItemsAdded);
  public sealed record MyMilestoneDto(int Count, bool Active);
  public sealed record MilestoneDto(string Key, int Target, int Progress, int Streak, int BestTarget, int Rung, int Rungs, MyMilestoneDto Mine);
  public sealed record CommunityStatsDto(DateTime GeneratedAt, StatsTotals Totals, PeriodCounts Interactions, List<GrowthPoint> Growth,
      TopCollectorDto? TopCollector, TrendingTypeDto? TrendingType, List<MilestoneDto> Milestones);
  public interface ICommunityStatsService { Task<CommunityStatsDto> GetAsync(Guid viewerId); }
  // GET api/Community/Stats → CommunityStatsDto ([Authorize]); keys "itemsAdded", "activeUsers"; Growth = 12 points, oldest first, last = current week.
  ```

- [ ] **Step 1: Failing tests** — `TotalsCountVisibleThings`, `HiddenAndDeletedAreNotCounted` (item in an unpublished type, tombstoned item and collection, deleted user, reaction on a hidden item → not in any number), `InteractionsThisWeekAndMonth` (events on both sides of the week / month start), `GrowthIsTwelveCumulativeWeeks`, `TopCollectorIsMostActiveThisWeek` (+ tie-break by items added), `SuspendedUserIsNotCollectorOfTheWeek`, `TrendingTypeCountsItemsAddedThisWeek` (`item.addedToExisting` quantity counts; hidden type never trending), `MilestonesReplayPastWeeks` (seeded weeks met / missed → expected target, streak, best), `MineCountsMyItemsAndActivity`, `EmptyDatabaseGivesZerosAndRungZero`, `MineIsPerUserWhileSharedPartIsCached` (second call 2 min later after a new event: shared unchanged, mine updated; after 6 min shared updated), `StatsNeedSignIn` (API: anonymous 401, signed-in 200 with `milestones[0].key == "itemsAdded"`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (one grouped query per series; week buckets computed in memory from `OccurredAt`/`CreatedAt`). **Step 4: Run** → PASS; full suite; `npm run check:errors` if new error codes.
- [ ] **Step 5: Commit** `feat(api): community stats`

### Task 3: App — Community tab, tiles, coming-soon pages

**Files:**
- Create: `src/Coffer/Coffer.ReactNative/src/app/tabs/community.tsx`, `src/app/community/stats.tsx` (placeholder until Task 4), `src/app/community/news.tsx`, `src/app/community/shape.tsx`, `src/app/community/_layout.tsx` (stack like other sections), `src/components/community/community_tile.tsx`, `src/components/community/coming_soon.tsx`, `src/i18n/locales/{en,hu}/community.json`
- Modify: `src/app/tabs/_layout.tsx` (4th `Tabs.Screen` "community" before "market"), `src/const/navigation_params.ts` (`ROUTES.TABS.COMMUNITY`, `ROUTES.COMMUNITY.{STATS,NEWS,SHAPE}`, `pageParams.community`, `pageParams.communityPage(titleKey)`), `src/components/itemregister/item_register_action_button_tabs.tsx` (hidden when `usePathname() === "/tabs/community"`), `src/i18n/locales/{en,hu}/navigation.json` (`tabs.community`), `src/i18n/resources.ts`

**Interfaces:**
- `CommunityTile({ icon, title, subtitle, color, onPress })` — `flex: 1`, retro border/shadow like other cards, `accessibilityRole="button"`, label = title + subtitle.
- `ComingSoon({ icon, title, text })`.
- Tiles: News (`newspaper-variant-outline`), Stats & facts (`chart-line`), Shape What's Next (`rocket-launch-outline`), colours from the theme (primary / secondary / surfaceAlt with contrast-checked text).

- [ ] **Step 1:** implement; **Step 2: Run** `npx tsc --noEmit`, `npm run check:i18n`, `npm run test:unit` → pass (no new pure logic in this task).
- [ ] **Step 3: Commit** `feat(app): Community tab with News, Stats & facts and Shape What's Next`

### Task 4: App — Stats & facts page

**Files:**
- Create: `src/types/entities/community.ts`, `src/utils/community_api.ts`, `src/hooks/community.ts` (`useCommunityStats()`), `src/utils/community_format.ts`, `tests/community_format.test.ts`, `src/components/community/stat_card.tsx` (count-up), `src/components/community/growth_chart.tsx` (react-native-svg), `src/components/community/highlight_card.tsx`, `src/components/community/milestone_card.tsx`
- Modify: `src/app/community/stats.tsx` (the page), `src/const/endpoints.ts` (`communityStats`), `src/const/querykeys.ts` or a per-user key helper (like the activity hooks), i18n `community`

**Interfaces:**
- `community_format.ts` (pure):
  ```ts
  export function compactNumber(n: number, locale: string): string;            // 1234 → "1.2K" (Intl compact), < 1000 as is
  export function chartPath(values: number[], width: number, height: number, pad: number): { line: string; area: string; points: {x:number;y:number}[] };
  export function ladderDots(rung: number, rungs: number, max?: number): ("past" | "current" | "future")[];  // windowed to max (default 7) around the current rung
  export function progressRatio(progress: number, target: number): number;   // 0..1, target 0 → 0
  ```
- Page sections in order: 2×2 stat cards (members, items + pieces, collections, interactions + "+N this week · +N this month"); growth chart with chips Members / Items / Collections; highlights (Collector of the week with `trophy` icon in the secondary/gold colour, avatar, name, "N actions this week", tap → profile via `api/Users/{id}` + `useOtherUserStore.setUser` + `ROUTES.OTHERUSER`; Trending item type with icon from `endpoints.icons`, colour, "N items added this week"); two milestone cards (target, progress bar, "x of target", streak with `fire` icon, ladder dots, your contribution line); pull to refresh; empty and error states.

- [ ] **Step 1: Failing tests** (`tests/community_format.test.ts`) — `compactNumberKeepsSmallNumbers`, `compactNumberShortensLargeOnes`, `chartPathSpansTheWidth` (first x = pad, last x = width − pad, highest value at y = pad, all-equal values draw a flat line, single value doesn't divide by zero), `ladderDotsWindowAroundCurrent`, `progressRatioIsClamped`.
- [ ] **Step 2: Run** `npm run test:unit` → FAIL. **Step 3: Implement** helpers and components. **Step 4: Run** `npm run test:unit`, `npx tsc --noEmit`, `npm run check:i18n`, `npm run check:errors` → pass.
- [ ] **Step 5: Commit** `feat(app): Stats & facts — numbers, growth, highlights and milestones`

### Task 5: Device check

- [ ] **Step 1:** restart the dev API; on the emulator open Community: three tiles fill the space, FAB hidden; News and Shape What's Next show coming soon; Stats & facts shows the seeded numbers, the chart switches series, collector of the week opens their profile, milestones show target/progress/your contribution; Hungarian texts fit.
- [ ] **Step 2:** fix what the check finds (failing test first where testable) and commit.
