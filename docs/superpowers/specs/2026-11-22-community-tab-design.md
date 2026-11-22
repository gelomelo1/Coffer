# Community tab and Stats & facts — design

## Intent

Give the app a place for the community as a whole: a **Community** bottom tab with three big tiles — **News**,
**Stats & facts**, **Shape What's Next** (contributing photos and data so new item types can come to the app). This
round builds the tab, the three entries, and the **Stats & facts** page; News and Shape What's Next open "coming soon"
pages. Stats & facts shows the community's numbers in a fun way and turns weekly activity into shared goals
(milestones) that every user moves just by using the app, and shows each user their own part in it.

## Goals

- Community tab as the 4th tab: Home · Collections · My Follows · **Community** · Market.
- Three tiles that together fill the whole area between the header and the tab bar; each opens its own page.
- Stats & facts:
  - totals: members, collected items, collections, community interactions;
  - interactions this week and this month;
  - a growth graph;
  - highlights of this week: most active collector (with a cup) and trending item type;
  - two weekly milestones — items added per week, active users per week — whose targets climb a ladder;
  - "your contribution" to each milestone this week.
- English + Hungarian.

## Non-goals

- The News page and the Shape What's Next page content (later rounds; this round: "coming soon" pages).
- Push notifications, rewards or badges for milestones.
- Per-user rankings beyond the single most active collector.

## Anti-goals

- A number that counts hidden things (items of unpublished item types, deleted accounts, deleted items).
- A page that is slow or hammers the database for every visitor.
- Exposing more about the most active collector than their public profile already shows.

## Approaches

| | How | Trade-off |
|---|---|---|
| **A — compute on request, short cache (chosen)** | One endpoint computes totals, series, highlights and milestones from existing dated data (members, items, collections, activity log); the shared part is cached ~5 minutes; the user's contribution is added per request. | No new table, can't drift; each cache refresh replays the weeks (cheap at this size). |
| B — weekly snapshot table | The hourly sweep closes each week into a table. | Fast reads, fixed history; adds a table, a backfill and a job that must not skip a week. |
| C — client computes | The app downloads raw lists. | Rejected: everyone's data to every phone. |

Your human partner picked **A**.

## Decided by your human partner

1. Community is the 4th tab; three tiles fill the space between header and tab bar; each navigates to its own page.
2. The third tile is named **Shape What's Next**.
3. **Trending category = item type** (B).
4. Milestones: targets sit on a **fixed ladder with variable steps** (determined here); a met week moves the target up
   one rung, a missed week moves it back down one rung — always to the same values as before.
5. Approach A.

## Design

### Weeks and months

A week runs Monday 00:00 – Sunday 24:00 **UTC**; "this month" is the calendar month (UTC). Milestones are judged on
completed weeks; the current week shows progress towards its target.

### What is counted (only visible things: published item types, live rows, accounts not deleted)

| Number | Source |
|---|---|
| Members | users not deleted |
| Collected items | live items in live collections of published types (and the sum of their quantities as "pieces") |
| Collections | live collections of published types |
| Interactions (all time) | likes + ratings (reaction rows) + visible comments + follows, on visible items / collections |
| Interactions this week / this month | activity log entries of the kinds `reaction.liked`, `reaction.rated`, `comment.posted`, `comment.replied`, `follow.followed` in the period (likes have dates only since the activity log, 20 Nov 2026) |
| Growth graph | per week, the last 12 weeks: cumulative members (`users.created_at`), collections (`created_at`), items (activity `item.added` + `item.addedToExisting` dates) |
| Most active collector this week | the user with the most activity log entries this week (ties: more items added, then earlier last activity); with avatar, name and count; none yet → friendly empty state |
| Trending item type this week | the published type with the most items added this week (activity `item.added` / `item.addedToExisting` with quantity); none → empty state |
| Items added per week (milestone) | activity `item.added` (1 each) + `item.addedToExisting` (its quantity) in the week |
| Active users per week (milestone) | distinct users with any activity log entry in the week |

### Milestone ladders (fixed values, variable steps)

- Items added per week: 10 · 15 · 25 · 40 · 60 · 90 · 130 · 180 · 250 · 350 · 500 · 700 · 1 000 · 1 500 · 2 000 · 3 000 · 5 000
- Active users per week: 3 · 5 · 8 · 12 · 18 · 25 · 35 · 50 · 75 · 100 · 150 · 200 · 300 · 500 · 750 · 1 000

Replay from the first week that has any activity, starting on rung 1: each completed week compares its count with its
rung's target — met → next week one rung up (capped at the top), missed → one rung down (floored at the first). The
current week's target is the rung the replay ends on. The page shows: target, progress so far (bar), how many weeks in
a row it was met (streak), and the highest rung ever reached.

### Your contribution (per request, not cached)

- Items: how many items you added this week, and your share of the week's count ("you added 4 of 23").
- Active users: whether you were active this week ("you're one of 9 active collectors this week" / a nudge if not).

### API

`GET api/Community/Stats` (signed-in users) →
```
{ generatedAt,
  totals: { members, items, pieces, collections, interactions },
  interactions: { thisWeek, thisMonth },
  growth: [ { weekStart, members, items, collections } ×12 ],
  topCollector: { userId, name, avatar, activityCount } | null,
  trendingType: { id, name, color, icon, itemsAdded } | null,
  milestones: [ { key: "itemsAdded" | "activeUsers", target, progress, streak, bestTarget, rung, rungs,
                  mine: { count, active } } ] }
```
Shared part cached in memory for 5 minutes (`IMemoryCache`); `mine` computed per request from the activity log.

### App

- **Tab:** `src/app/tabs/community.tsx`, icon `account-group`, title "Community" / "Közösség"; the floating "+" button is
  hidden on this tab.
- **Tiles:** a column of three equal-height tiles filling the space (`flex: 1` each, gap 12, padding 16), each with a
  big icon, title and one-line subtitle, distinct colour from the theme; press feedback; accessible labels.
  - News — "What's new in Coffer" — `newspaper-variant-outline`
  - Stats & facts — "The community in numbers" — `chart-line`
  - Shape What's Next — "Help bring new item types to Coffer" — `rocket-launch-outline`
- **News / Shape What's Next pages:** a friendly "coming soon" screen explaining what will be there.
- **Stats & facts page** (scroll, pull to refresh):
  1. Big-number cards (2×2): members, items (pieces as subline), collections, interactions — numbers count up once on
     open (skipped when reduced motion is on); interactions card shows "+N this week · +N this month".
  2. Growth graph: line chart (react-native-svg) of the last 12 weeks, series switch chips Members / Items /
     Collections.
  3. This week's highlights: **Collector of the week** with a gold cup (trophy icon), avatar, name, "N actions this
     week" (tap → their profile); **Trending item type** with its icon and colour, "N items added this week".
  4. Milestones: two cards with target, progress bar, "x of target", streak flame, ladder dots (current rung of all
     rungs), and **your contribution** line.
- Empty states for a brand-new database; error state with retry.

### Data and privacy

The collector of the week shows only name and avatar (already public on profiles). Deleted accounts never count, and
a user suspended at the time of the request is skipped (the next most active collector is shown).

## Calls made while writing this up (your human partner can overturn them)

1. Weeks are Monday-based in UTC; "this month" is the calendar month.
2. Most active collector = most activity log entries this week.
3. "Interactions" = likes, ratings, comments, follows (not chat messages or deals).
4. The ladders above; replay starts at rung 1 in the first week with any activity.
5. The floating "+" button is hidden on the Community tab (it would cover a tile).
6. Numbers count up once on open (not with reduced motion).
7. A suspended user is never shown as collector of the week.

## Left to the builder

- Exact colours of the tiles (from the theme), card layout details, chart styling.
- How the queries are grouped (one grouped query per series).
