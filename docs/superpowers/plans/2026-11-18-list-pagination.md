# List Pagination Implementation Plan

**Goal:** Every content list in the app loads 20 entries at a time; the backend returns the total count for the current
filters; scrolling to the end of a list loads the next 20 and appends them.

**Decisions (user):** page size 20; grouped screens (my collections, my follows) use approach A — the backend sorts by
collection type first, so scrolling continues the current group or starts the next, and group header counts come from
the backend.

**Decisions (mine):**
- Paged responses: `{ items, page, pageSize, total }` (`PagedList<T>`); grouped ones add `groupCounts` (type id → count).
- Page size: default 20, clamped to 1–50 on the server. Stable order: every paged query ends with the id as tie-breaker.
- Generic read endpoints keep their array response (forms/pickers use them); paged lists use `GET api/<Controller>/Page`.
- Chat messages load older messages when scrolling up (cursor `before`), newest page first; inverted list.
- Search "All" tab shows the first page of users/collections/items with their totals; the scoped tabs page on scroll.
- Market tab badges come from a small `GET api/Market/Badges` instead of the full inbox and deal lists; the chat screen
  gets the conversation's latest deal id from the conversation itself; listing details asks the inbox for that listing.
- Pull to refresh restarts from page 1. Appended pages are de-duplicated by id (new rows can shift offsets).
- Not paged: pickers/dropdowns (attributes, options, carriers, cities, languages, collection picker in item register).

## Tasks

1. **Backend paging core** — `PagedList<T>`, `Paging.Normalize`, `ToPagedListAsync`; generic repository `GetPageAsync`;
   `GET api/<Controller>/Page`. Tests: totals with filter, stable order, clamping.
2. **Feed, follows, collections** — `GET api/Feed` paged (newest first); `GET api/Feed/UserFollows` grouped page;
   `GET api/Collections/Grouped?userId&byName=` grouped page (per-type sort name/newest). Tests.
3. **Search** — `GET api/Feed/Search/{users|collections|items}` paged; mixed search returns first page + totals;
   `GET api/Feed/SearchTag` paged by tag group. Tests.
4. **Marketplace** — listings search, my listings, inbox (+ `subjectId`), deals, user reviews, my reports, against me:
   paged; messages: `before` cursor + `limit`; `GET api/Market/Badges`; `ConversationDto.LatestDealId`. Tests.
5. **App paging core** — `usePagedQuery` (useInfiniteQuery, page size 20, flatten + de-dupe, total), list footer
   spinner, pure helpers unit-tested (next page param, merge, grouping in arrival order).
6. **App screens** — wire every list above; counts from `total` / `groupCounts`; i18n en + hu.
7. **Verify** — dotnet test, app unit tests, tsc, i18n/error checks, device check with small page size via API, commit.
