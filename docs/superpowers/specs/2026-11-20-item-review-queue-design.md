# Waiting-for-review list for adding items

## Why

Adding items starts with a photo. The AI service finds every cap on it, and the user decides for each one: add it as a new item, add it to an existing item, or leave it out.

A photo of a big haul produces many caps, and today the user has to finish the whole review in one sitting:
- The review lives only on the screen.
- The AI service deletes each detected cap's crop and fingerprint (embedding) 10 minutes after the check (`save_temp_files.py`). One missing file makes the whole save fail and roll back.

Users need to stop at any point and come back later, on any device, without losing anything. A cap is gone only when they choose that.

## Goals

- **Persisted detections:** every detected cap is stored on the server as a **pending item** in its collection's **waiting-for-review list**, permanently, until the user decides.
- **One upload, several photos,** from the gallery (multi-select) or the camera (shoot, "Take another", "Done").
- **New detections join the same list:** each new upload adds to the collection's list, and the review screen walks the whole list, newest first.
- **Three actions per cap, each with a 5-second Undo:**
  - **Add** turns the cap into a new item, or adds its quantity to a chosen existing item.
  - **Skip** leaves it waiting and shows the next cap.
  - **Skip & delete** removes the pending item and every file stored for it.
- **A redesigned review screen:**
  - The action bar is always visible.
  - Required fields come first, with the primary attribute on top, and optional fields after them.
  - Add is disabled until every required field has a value, and a live line next to the buttons says what's still missing.
- **Two ways into the list:**
  - from each collection, through a banner;
  - from a Settings entry that lists every collection with waiting caps. The planned "My activity" menu will host it later.
- **A first-time explanation** of how adding works, reachable again from an ⓘ button.
- **A `required` flag on attributes.** The primary attribute is always required.

## Non-goals

- "Add all as suggested". Your human partner left it out.
- The "My activity" area and the activity log. That's a separate project, designed next.
- Expiry of pending items. They are the user's data and stay until the user decides.
- An admin UI for attributes. The `required` flag is reference data, set by migration or seed.

## Anti-goals

- Losing a detected cap that the user didn't Skip & delete: through a crash, closing the app, waiting too long, or a failed save.
- Adding the same detection twice, for example through a retry or an Undo race.
- An action button the user has to scroll to reach.
- Leaving pending files or rows behind for a deleted collection or account.

## Constraints

- **Stack:**
  - Backend: ASP.NET Core 8 + EF Core.
  - Schema: a hand-run SQL migration in `src/startup/`, with the EF model kept in sync.
  - AI service: Python FastAPI (`Coffer.PythonService`), with ChromaDB holding the fingerprints.
  - App: Expo / React Native with i18n in en + hu (`check:i18n` and `check:errors` must pass).
- **Shared storage:** the API and Python containers share `/app/data/images` (`IMAGESTORE_PATH`) and `/app/data/temp` (`IMAGECHECK_TEMP_PATH`). Pending files live under `IMAGESTORE_PATH/pending/`.
- **The deletion rule from the account-deletion work still holds.** Deleting items and collections goes through `ContentTombstoneService`, and pending items of a deleted collection or account are hard-deleted, files included. They are the owner's own data, and nobody else links to them.
- **Git:** no branches, no pushes, no Co-authored-by trailers.

## Approaches

| | What | Trade-off |
|---|---|---|
| **A: pending rows in the database, files moved to permanent storage (chosen)** | Right after the AI check, the backend stores each detection as a `pending_items` row and moves its crop and fingerprint from the 10-minute temp folder to `images/pending/`. A new AI call finds matches from a stored fingerprint when the cap is opened. | One new table and one new AI endpoint, and the save path changes. In return the list is visible everywhere, survives anything, and is cleaned up with the collection or account. |
| B: the AI service keeps the list | The Python service stores pending caps next to its fingerprints. | User data split across two systems; counts, deletion and the activity log would all have to ask Python. |
| C: the phone keeps the list | Review state is kept on the device and the temp files live longer. | No Settings overview, no second device, and the caps are lost with the phone. |

Your human partner picked **A**.

## Decided by your human partner

- **Review order:** the review walks the collection's **whole** waiting list, newest first. A new upload's caps come first, then the older ones.
- **Actions:** Add, Skip, and Skip & delete, each with a 5-second Undo, after which the next cap opens.
- **Skip** keeps the cap on the waiting list. **Skip & delete** removes it and all its resources.
- **Required fields:**
  - Add stays disabled until every required field has a value.
  - Required fields come first, primary on top, then optional fields.
  - The missing required fields are tracked live next to the Add button.
- **Layout:** the action buttons are always on screen. The page is redesigned to be as user-friendly as possible.
- **"Required" is a per-attribute flag,** and the primary attribute is always required.
- **Approach A.**

## Design

### Data

New table `pending_items`:

| column | |
|---|---|
| `id uuid` | the detection id the AI service gave the crop (its file name) |
| `user_id uuid` → users | owner |
| `collection_id uuid` → collections | which collection's list |
| `quantity int` | detected count, at least 1 |
| `image text` | file name under `IMAGESTORE_PATH/pending/` (jpg) |
| `created_at timestamptz` | the list is ordered newest first by this |

- **Indexes:** on (`collection_id`, `created_at desc`) and on `user_id`.
- **The fingerprint** is stored as `{id}.npy` next to the jpg and isn't a column.
- **Foreign keys** cascade from the collection and the user. Rows are only hard-deleted by the code paths below; collections and users are tombstoned, never hard-deleted, so in practice the cascade never fires.

`attributes` gets `required boolean not null default false`. The migration sets `required = true` where `primary = true`. The rule "primary is always required" is also applied in code, so a forgotten flag can't make the primary optional.

### Detection

`POST api/Collections/ImageCheck/{collectionId}` is called once per photo.
1. It calls the AI service as today. The answer per detection is `{ id, state, quantity, similars }`, and the crop and fingerprint land in the temp folder.
2. Each detection's files are moved at once, within the same request, from temp to `images/pending/`.
3. A `pending_items` row is inserted for each detection.
4. The response is the new pending items, in the same shape the list endpoint uses (below).
- **A detection whose files can't be moved** (they vanished) is left out and reported as a count, `lost`. The others are kept.
- **The 10-minute auto-delete in `save_temp_files.py` stays.** Moved files are simply no longer there, which it already tolerates. It now only cleans up abandoned checks.

### Matches when opened

New AI-service endpoint `POST /pending_similars/{collection_id}`, with body `{ "ids": [pending ids] }`.
- For each id it loads `pending/{id}.npy`, queries ChromaDB as `build_image_check_response` does, and returns `{ id, state, similars }`. It uses the same thresholds, top 3, filtered to the collection.
- A missing `.npy` gives `state: "not found"` and no similars, never an error for the whole batch.

The backend calls it for each page of the list. Matches therefore reflect the collection as it is when the cap is opened, so a cap added a minute ago is offered as a match for its duplicate from another photo.

### Pending item API (new `PendingItemsController`)

All endpoints are for the signed-in owner only; another user's pending item answers 404.

- **`GET api/Collections/{id}/Pending?page&pageSize`:** the collection's list, newest first. Each entry: `{ id, quantity, createdAt, state, similars: ItemProvided[] }`, where `state` and `similars` are freshly matched and include each match's name attribute, quantity and image. The response is a `PagedList` with `total`.
- **`GET api/Pending/Summary`:** `[{ collectionId, collectionName, collectionTypeId, count, latestImage }]` for every collection of the user that has waiting caps. It feeds the Settings list, the collection banners and badges.
- **`GET api/Pending/Image/{id}`:** the crop image (owner only).
- **`POST api/Pending/{id}/Add`** takes one of two bodies:
  - `{ matchItemId, quantity }` adds `quantity` to that live item of the same collection;
  - `{ item: ItemRequired, quantity }` creates a new item. It validates that every required attribute has a value (400 `requiredAttributeMissing` with the attribute's name), copies the pending jpg to the item image folder, and saves the fingerprint to ChromaDB through a new AI endpoint `POST /save_pending_embedding/{collection_id}` with `{ pendingId, itemId }`, which reads from `pending/`.
  - Then it deletes the pending row and its files and returns the item. If the AI call fails, nothing is saved (400/502) and the cap stays waiting.
- **`DELETE api/Pending/{id}`** (Skip & delete): deletes the row, the jpg and the npy. It's idempotent, and an already-deleted cap answers 204.

### Undo: the action is committed after the 5 seconds, not reversed

Undo doesn't reverse a saved change. Instead, the app holds each Add or Skip & delete for 5 seconds before sending it, and Undo cancels it before it's sent.

**Why this is safe:**
- **A lost action leaves the cap waiting.** If the app is killed inside the 5 seconds, the action is never sent, so the cap is still on the list. Losing a decision costs one more tap later, never data.
- **No reverse logic on the server,** so nothing has to un-add an item that someone may already have looked at.

**Details:**
- **One action at a time.** A second action while one is pending sends the first immediately, so only the newest can be undone, which is the usual pattern.
- **Leaving the review screen** (close, back, app to background) sends whatever is pending at once.
- **A send that fails** (validation, network) shows "Couldn't add ‹name›: it's still waiting", and the cap reappears in the list.
- **Skip** is client-only. It moves on, and Undo moves back.

### Review screen (replaces `item_register_overlay` + `item_register_card`)

```
┌─────────────────────────────────────┐
│ ✕  Waiting for review    ⓘ   3 / 14 │  header: close (always safe), help, progress
├─────────────────────────────────────┤
│  [ your photo ]   [ selected match ]│  side by side, tap to enlarge
│   Your photo      Heineken · have 2 │
│  (+ New) (#1 Heineken) (#2 …) (#3 …)│  match chips with name + count
│  REQUIRED                           │
│  Brand *        [_______________]   │  primary first, then other required
│  Quantity *     [ − ]  2  [ + ]     │  detected count, editable, ≥ 1
│  OPTIONAL  ▸ Features · Tags · Note │  collapsed; opens in place
├─────────────────────────────────────┤  fixed action bar (safe-area aware)
│  ⚠ Still needed: Brand              │  live; or "✓ Ready to add"
│  [Skip & delete]  [Skip]  [ Add ✓ ] │
└─────────────────────────────────────┘
   ┌ Added "Heineken" ·  UNDO  (5 s) ┐   undo bar above the action bar
```

- **The top area** (photos and matches) and the fields scroll. The action bar never scrolls and sits above the keyboard when it's open.
- **"+ New" selected:**
  - The form shows required attributes first (primary on top), then Quantity, then a collapsed "Optional" section with the other attributes, tags, private note and description.
  - The "Still needed" line lists the missing required fields by name, and tapping one focuses that field.
  - Add is disabled with a reason; it's never a silent dead button.
- **A match selected:** the form is hidden, since the item already exists. Only Quantity stays, and the line reads "✓ Ready to add · +2 to Heineken".
- **The default choice:** match #1 when the AI says "found", otherwise "+ New", as today.
- **Skip & delete** is red and kept apart from Add, with outline styling. Undo is its safety net, so there's no confirmation dialog.
- **After each action** the next cap opens with a short slide, which respects reduced motion.
- **An empty list** shows "Nothing waiting. All caught up" with a "Close" button.
- **Help:** the first time the review opens on a device, a short three-step explanation sheet shows: photos → we find each cap → Add / Skip / Skip & delete, with undo. "Don't show again" is stored per device. The ⓘ button reopens it.
- **Accessibility:**
  - All buttons are at least 48 dp tall.
  - The disabled Add announces "Add, disabled, still needed: Brand".
  - The undo bar is announced politely, with the Undo button reachable.
  - Colour is never the only signal: the ⚠ / ✓ icons come with text.
- **Fixed on the way:** the form's private-note field wrote into `description` (`item_register_form.tsx:97`).

### Starting an upload

- The collection screen's add button opens a sheet: "Take photos" or "Choose from gallery".
- **Gallery:** multi-select, up to 10.
- **Camera:** after each shot, "Take another" or "Done (n)".
- Then one progress screen, "Checking photo 2 of 5", checks the photos one by one.
  - A failed photo shows in a short result list with Retry; the others go ahead.
  - "N caps found · M photos had none" leads into the review screen, which starts at the newest caps.

### Ways into the list

- **The collection screen** (`mycollection`) shows a banner above the items when caps are waiting: "8 caps waiting for review · Review". It opens the review screen for that collection.
- **The collections tab** cards show a small "8 waiting" tag.
- **Settings:** a new entry, "Waiting for review" (with a count badge), opens a list of collections with waiting caps (`api/Pending/Summary`: thumbnail, name, count). Tapping one opens its review screen. This screen moves under "My activity" when that project lands.

### Deletion and cleanup

- **Tombstoning a collection** through `ContentTombstoneService` also deletes its pending rows and their files.
- **Deleting an account** does the same for all of the user's pending rows.
- **Skip & delete** and a successful Add delete their files immediately.

## Calls made while writing this up (your human partner can overturn them)

1. **Undo holds the action for 5 seconds before sending it,** rather than sending at once and reversing on Undo. The worst case for a crash is "the cap is still waiting", there's no server-side undo, and nothing is half-done.
2. **The first-time help is remembered per device,** not per account. That's a small cost: a second phone shows it once more.
3. **Waiting caps are counted per detection.** Several identical caps on one photo are one pending item with a quantity, as the AI groups them today.
4. **The same cap on two photos of one upload** becomes two pending items. After the first is added, matching offers it for the second.
5. **The gallery limit is 10 photos per upload,** to keep the AI checks reasonable. More can be added in the next upload.

6. **When a required field counts as filled:**
   - text, select, multi-select and autocomplete: not blank;
   - number: entered;
   - date: set;
   - a boolean always counts as filled, since false is a value.
   The app and the server use the same rule.
7. **The new-item Add ignores the `image` the client sends.** The server uses the pending crop.
8. **`POST api/Items/Upsert` and the old image-check response shape stay** for any other callers. The new review screen no longer uses them.
9. **Paging:** the review screen loads the list 20 at a time and fetches the next page as the user nears its end.

## Left to the builder

- Exact component split and file names of the new review screen, within the existing `itemregister` folder style.
- Exact animation timings, using the existing theme's motion conventions.
- Whether the Python `pending_similars` call batches into one ChromaDB query or loops.
- Copy wording beyond the strings fixed above (en + hu).
