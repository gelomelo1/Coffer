# Shape What's Next (contribution) — design

Date: 2026-11-26 · Follows: `2026-11-22-community-tab-design.md` (third tile), `2026-11-23-model-trainer-design.md`
(the photos collected here are the trainer's input).

## Intent

The third Community tile, **Shape What's Next**, becomes the place where the community helps bring the next item type
to Coffer. An administrator runs it from a new **Contribution** tab in Coffer.Manager in rounds:

1. **Voting phase** — users vote for one of three candidate item types and write, in free text, which attributes they
   would like to see and why it would be good.
2. **Photo phase** — for the winning candidate, users upload photos for the two models a new item type needs:
   **object detection** (many photos, all users into one pool) and **classification** (forms of 5–10 photos of the
   same physical item).

When the photo phase closes, the administrator takes the photos and fine-tunes the models with the Model training view.
Between rounds the contribution is switched off and the phone says why.

## Goals

- **Switch (Manager):** contribution on / off.
  - Off → the phone shows "No contribution period right now" and one reason the admin picks from four.
  - On → it always points to one phase that is draft or open (or a new one created there). A draft opens when enabled.
  - Switching off while a phase is open **pauses** it: hidden from users, still open, the clock keeps running; it can
    be switched on again later.
- **Phase states:** draft · open · closed · interrupted (stopped by the admin; for a voting phase, no winner).
- **Voting phase:** three candidates; one vote per user plus free text; in the Manager, for open and closed phases,
  the vote count per candidate and every user's free text; an end date the admin can change (extend) any time.
- **Photo phase:** based on a closed voting phase that has a winner (the most recent one highlighted and preselected);
  detection uploads and classification forms; each user sees how many detection photos they uploaded and how many
  classification forms they completed; guideline text and an example gallery for each form; a changeable end date.
- **Phone:** a countdown (days + hh:mm:ss) and a progress bar for the open phase.
- **Image sizes:** every photo upload is resized **on the phone** (fast upload), and every upload endpoint resizes **on
  the server only when a photo arrives bigger than the app would send** (someone calling the endpoint without the app).
  Contribution photos follow this; listing and shipping/receipt photos, which the phone sends at full size today, get
  the phone resize and the server safety net too.
- **Activity:** votes, detection uploads and completed classification forms are activity — in the user's My activity
  log, and in Stats & facts for active users only (not collector of the week).
- English + Hungarian.

## Non-goals

- Moving media to Cloudflare R2 (a later round; the folder layout below is chosen so it maps 1:1 to object keys).
- An export / download button in the Manager (the admin takes the files from storage; later from R2).
- Reviewing or deleting single uploaded photos in the Manager (cleaning happens while preparing the training data).
- Starting the next phase automatically, rewards, badges, push notifications.
- Example galleries per item type (one general gallery, of caps, serves every round).
- Re-processing photos already stored by listings and deals before this change.

## Anti-goals

- A stored contribution photo that still carries metadata (GPS location, device, time) — they come from people's homes.
- A vote or upload accepted after the end time, or while the contribution is off / paused.
- A user with two votes in one phase.
- A half-saved classification form (some photos stored, form missing, or the other way round).
- A photo phase without a clear subject (no winner).
- Live vote counts on the phone steering later voters.

## Constraints

- Backend: ASP.NET Core 8 + EF Core; schema by hand-run SQL in `src/startup/`; xUnit on SQLite + API tests; admin
  endpoints on `ManagerControllerBase` (Manager token, admin re-checked per request, admin audit log).
- Manager: Python / Tkinter, one view per entry in `initialize.py` `VIEWS`; API client in the existing style; unittest.
- App: Expo / expo-router; `expo-image-picker`, `expo-camera`, `expo-image-manipulator` already present — no new
  native module, no new development build. Theme, retro UI kit and i18n (en + hu) as in the other Community pages.
- Storage: files under `AppPaths.Root/data/…`, mounted into the API container.
- Git: no branches, no pushes, no Co-authored-by trailers.

## Approaches

| | How | Trade-off |
|---|---|---|
| **A — one phase table for both kinds (chosen)** | `contribution_phases` with `kind` (vote / photo), state, dates, source vote phase; side tables for candidates, votes, uploads, forms; one settings row for the switch. | States, pausing, end dates, countdown and "one active phase" written once; one phase list in the Manager. A few columns apply to one kind only. |
| B — a table per kind | Vote phases and photo phases separately, each with its own state handling. | Tidier columns; every rule written twice, and the switch points at "one of two tables". |
| C — counts from the folder, no rows per photo | Count files on disk. | Rejected: per-user counts and the daily limit need to know who uploaded what. |

Closing at the end date: the state is evaluated on every request (an open phase past its end date counts as closed
immediately — votes and uploads stop at 00:00:00, not up to a minute later); the existing maintenance service
(`MarketplaceMaintenanceService`'s loop, or a sibling registered the same way) persists the change and switches the
contribution off.

Your human partner picked **A**.

## Decided by your human partner

1. Switch with four reasons; on = a draft or open phase (or a new one); a draft opens when enabled.
2. Switching off while a phase is open **pauses** it (option A).
3. Voting: three candidates, a vote plus free text about attributes and why; states draft / open / closed /
   interrupted; vote counts and every free text visible in the Manager for open and closed phases; changeable end date.
4. Photo phase needs a closed voting phase with a winner; the most recent one highlighted.
5. Detection: multiple images per user, all users into the same folder. Classification: a form of 5–10 photos of the
   same item, any number of forms. Both forms always available; the user sees their counts.
6. Guideline texts as given, with "item" instead of "cap" (below).
7. Example gallery: **one fixed folder per form that the admin fills by hand** (option B), general for every item type,
   cap photos; no good / bad split — good and bad examples are marked on the images themselves.
8. No export; media moves to Cloudflare R2 later.
9. Approach A.
10. Photos are resized on the phone for fast upload (contribution photos like the rest of the app); the server resizes
    only a photo that arrives bigger than the app would send (an endpoint used without the app). Applies to every
    upload, including the listing and shipping/receipt photos the phone sends at full size today.
11. Contributions count as activity: My activity, and active users in Stats & facts — not collector of the week.

## Design

### States and the switch

```
          enable (with this phase)              end date passes / Close now
 draft ───────────────────────────► open ──────────────────────────────► closed
   │                                  │  ▲
   │ delete                           │  │ enable again (same phase)
   ▼                                  ▼  │
 (gone)                       open + switch off = "paused" (not a state)
                                      │
                                      │ Interrupt
                                      ▼
                                 interrupted
```

- **Draft:** fully editable; can be deleted. Not visible to users.
- **Open:** set when the switch is turned on with a draft (`opened_at` = now). The end date must be in the future
  (at least 5 minutes ahead). Candidates are locked once open (votes refer to them); the end date can be set to any
  time at least 5 minutes in the future, any number of times.
- **Paused** is not a state: an open phase while the switch is off (or the switch points elsewhere). The clock keeps
  running; if the end date passes while paused, the phase closes.
- **Closed:** at the end date or with **Close now**. For a voting phase the winner is decided at that moment (below).
- **Interrupted:** **Interrupt** from open (paused or not). A voting phase gets no winner; a photo phase keeps the
  photos already uploaded. Terminal, like closed.
- **Only one open phase at a time.** Enabling with a phase while a different phase is open is refused ("Close or
  interrupt *X* first").
- When the **active** phase closes or is interrupted, the switch turns off. On close by date (or Close now) the reason
  becomes **"one just finished"**; on Interrupt the Manager asks for the reason in the same dialog.
- Settings row: `enabled`, `reason`, `active_phase_id`. Enabled requires an active phase in draft or open; disabled
  requires a reason. Enabling clears the reason only for display (the last one is kept as the default next time).

Reasons (keys → texts):

| key | English | Hungarian |
|---|---|---|
| `justFinished` | A contribution round just finished. Thank you for taking part! | Most ért véget egy közös forduló. Köszönjük, hogy részt vettél! |
| `communityTooSmall` | The community isn't big enough yet — invite your friends! | A közösség még nem elég nagy — hívd meg a barátaidat! |
| `contributionFinished` | The contribution is finished. | A közös munka befejeződött. |
| `modelsInProgress` | The models for new item types are in the works right now. | Az új tárgytípusok modelljei most készülnek. |

The phone shows the title "No contribution period right now" / "Jelenleg nincs közös forduló" and the reason under it.

### Voting phase

- Exactly **3 candidates**, each: name (1–60), name translations (JSON, `{"hu": "…"}`, same rules and Manager JSON box
  with grey placeholder as item types), description (0–300), description translations.
- **One vote per user per phase**, with free text **required, 10–1000 characters** ("Which attributes would you like to
  see, and why would it be good?"). The user can **change** both the vote and the text until the phase closes (upsert).
- Users never see counts while the phase is open.
- **Winner** at close (by date or Close now), decided automatically: the candidate with the most votes. **Tie**: the
  phase closes with no winner yet and the Manager shows "Tie — pick the winner" with the tied candidates; picking
  stores the winner. **No votes at all**: closed without a winner; the admin may pick one of the three with "Pick
  winner". **Once stored, a winner never changes** (Pick winner is offered only while a closed voting phase has none),
  so a photo phase's subject can never shift under its photos.
- After it closes, the phone's "no contribution" page shows a **Latest result** card for the most recent closed voting
  phase with a winner: the winner's name and each candidate's share of the votes (bars with percentages and counts).

### Photo phase

- Created from a **closed voting phase with a winner**. The Manager's picker lists only those, newest first; the most
  recent is preselected and marked "(most recent)". The phase's subject is the winning candidate (name + description,
  with translations), read through `source_phase_id` (safe, because a stored winner never changes).
- **More than one photo phase may come from the same voting phase** (e.g. a second photo round for the same item type).
  The picker and the phase list show "used by N photo phase(s)" next to a voting phase that already has one; "(most
  recent)" / ★ still go by the voting phase's close date. Each photo phase has its own folder; combining two rounds is
  done while preparing training data.
- **Object detection:** the user picks photos from the gallery (multiple) or takes them with the camera, reviews the
  thumbnails (can remove), and sends **1–20 photos per upload**. All users' photos go into one folder.
- **Classification:** a form is built on the phone — photos from the camera (one by one, repeatable) or the gallery
  (multiple) — and is sent only when it has **5–10 photos**, all in one request. Leaving a form with photos in it asks
  "Discard this form?" first. The server stores the whole form or nothing.
- **Daily limit:** at most **300 contribution photos per user per UTC day** (detection and classification together).
  The phone shows how many are left when fewer than 40 remain; a refused upload says when it resets.
- Each user sees: "You uploaded N photos" (detection) and "You completed N forms" (classification) for this phase.
- In the Manager: totals for the phase — detection photos, classification forms, classification photos, contributors —
  and the storage folder path.

### Guideline texts (shown on each form; English below, Hungarian translated in the same tone)

**Classification:**

> To make the model as accurate as possible, please follow these guidelines:
>
> **Different angles:** Rotate the item and take photos from different sides and perspectives.
> **Vary the lighting:** Try different lighting conditions, but avoid extremely bright or dark images.
> **Change the background:** Use different backgrounds to help the model focus on the item itself.
> **Keep the item consistent:** Every photo must show exactly the same physical item.
> **Vary the distance:** Feel free to experiment with camera distance, but keep the item clearly visible and avoid
> shots that are too far away.
> **Slight tilts:** You can slightly tilt the item by a few degrees, but avoid extreme angles.
>
> **Think of it this way:** Take photos that would make it easy for you to recognize the item, even if the angle,
> background, or lighting changes.

**Object detection:**

> You can upload photos containing different items, multiple items in the same image, or a combination of items and
> other objects. You do not need to use the same item across all images.
>
> To help make the model more accurate and robust, please follow these guidelines:
>
> **Different items:** Include as many different item designs, colors, and styles as possible.
> **Multiple objects:** Feel free to include several items in a single photo.
> **Vary the distance:** Take photos from different distances, but keep the objects reasonably visible.
> **Change the background:** Use different surfaces and backgrounds to improve detection in various environments.
> **Vary the lighting:** Include different lighting conditions, avoiding exclusively extremely bright or dark images.
> **Slight tilts:** Experiment with small changes in camera and object angles, but avoid extreme tilts.
> **Hard negative examples:** This is particularly important! Include some photos containing objects that look similar
> to the items but are NOT the items, such as objects with a similar shape, size, color or pattern. These help the
> model learn what it should NOT detect as an item.
>
> **Important:** Not every image needs to contain all these variations. Try to create a diverse collection of realistic
> photos, including both items and visually similar objects that are not items.

(The original's cap-specific examples — "coins, circular objects, badges, lids" — are replaced by a general phrase,
since a coin may be the next item type.)

### Storage

New folder `AppPaths.Contributions` = `Root/data/contributions`:

```
contributions/
  examples/
    detection/          example gallery of the detection form (admin fills by hand)
    classification/     example gallery of the classification form (admin fills by hand)
  {photoPhaseId}/
    detection/{uploadId}.jpg                 every user's detection photos, one pool
    classification/{formId}/{uploadId}.jpg   one completed form = one physical item = one class folder
```

`classification/` is directly the Model trainer's embedding input (one sub-folder per item); `detection/` is the pool
to annotate in Label Studio. The same relative paths become R2 object keys later.

- **Development:** new mount in `docker-compose.dev.yml`:
  `E:\Homework\Programming\AI\szakdolgozat\data\contributions:/app/data/contributions`.
  The admin drops example images into `…\data\contributions\examples\detection\` and `…\examples\classification\`.
- **Production:** new named volume `contributions_data:/app/data/contributions` in `docker-compose.prod.yml`; the
  README documents copying examples in (`docker cp <files> <api container>:/app/data/contributions/examples/detection/`)
  and photos out (`docker cp <api container>:/app/data/contributions/<phaseId> .`).
- **Example gallery:** JPEG / PNG / WebP files in the folder, shown in filename order (a prefix like `01_` sets the
  order); other files ignored; the folder is read on request (cached 1 minute), so new files show up without a
  restart. Empty folder → the Examples button is hidden.

### Image sizes (contribution and every other upload)

**Rule:** the phone resizes every photo before sending (fast upload, little data). Every upload endpoint checks what
arrives and resizes **only when the photo is bigger than the app would have sent it** — i.e. someone used the endpoint
without the app. A photo the app prepared is stored as it arrives (no second compression).

Audit of the app's uploads and the result:

| Upload | Phone today | Server today | Phone after | Server safety net after |
|---|---|---|---|---|
| Item photos (AI check) | `resizeForUpload`: 800 px wide, JPEG 0.7 | stored as sent | unchanged | wider than 800 px → 800 px wide |
| Collection cover | `CustomImageResize`: 800 px wide, JPEG 0.7 | stored as sent | unchanged | wider than 800 px → 800 px wide |
| Listing photos | picker quality 0.6, **full size** | stored as sent | **1600 px wide, JPEG 0.8** (new `listingImageResize`) | wider than 1600 px → 1600 px wide |
| Shipping / receipt photos | picker quality 0.6, **full size** | stored as sent | **1600 px wide, JPEG 0.8** | wider than 1600 px → 1600 px wide |
| **Contribution photos** | — | — | **800 px wide, JPEG 0.7** (`resizeForUpload`, like item photos) | wider than 800 px → 800 px wide |
| News images (Manager) | — | ≤ 1600 px, JPEG 85 | — (admin tool) | unchanged |

- **Phone:** `resizeForUpload(asset, config = highImageResize)` gains the config parameter; listing and shipping photos
  call it with `listingImageResize = { width: 1600, compress: 0.8 }` before upload (in `listing_form_overlay.tsx` and
  `shipping_overlays.tsx`). Same width-based rule as today: a photo already narrower is sent as it is.
- **Server:** one shared helper `UploadedImages.PrepareAsync(file, maxWidth)` used by every user upload path above
  (`ImageService.SaveImageAsync` callers for covers, listings and deals, the pending item image save, contribution
  uploads). It validates the file (existing `ImageUploadGuard`: 8 MB, JPEG / PNG, magic bytes), reads only the image
  header to get the size and whether it carries metadata, and:
  - width ≤ `maxWidth` **and** no metadata → stores the bytes as they are;
  - otherwise → ImageSharp: apply EXIF orientation, resize to `maxWidth` wide (keep aspect ratio, never upscale),
    drop all metadata (EXIF, XMP, IPTC), save as JPEG quality 85 (contribution: 90, to keep training data sharp).
  The mirror of the phone's rule means app uploads pass straight through; a direct call can neither store a huge photo
  nor a photo carrying GPS location.

### Data (migration `src/startup/contribution_migration.sql`)

| table | columns |
|---|---|
| `contribution_settings` | `id int PK` (always 1), `enabled bool`, `reason varchar(32) NULL`, `active_phase_id uuid NULL`, `updated_at`, `updated_by uuid NULL` — seeded: disabled, reason `communityTooSmall` |
| `contribution_phases` | `id uuid`, `kind` (`vote`\|`photo`), `state` (`draft`\|`open`\|`closed`\|`interrupted`), `opened_at NULL`, `ends_at NULL`, `closed_at NULL`, `source_phase_id uuid NULL` (photo → its voting phase), `winner_candidate_id uuid NULL` (vote), `created_at`, `created_by`, `updated_at`, `updated_by` |
| `contribution_candidates` | `id uuid`, `phase_id`, `position` (1–3), `name varchar(60)`, `name_translations jsonb '{}'`, `description varchar(300)`, `description_translations jsonb '{}'` |
| `contribution_votes` | `phase_id`, `user_id` (PK together), `candidate_id`, `text varchar(1000)`, `created_at`, `updated_at` |
| `contribution_forms` | `id uuid`, `phase_id`, `user_id`, `photo_count`, `created_at` |
| `contribution_uploads` | `id uuid`, `phase_id`, `user_id`, `kind` (`detection`\|`classification`), `form_id uuid NULL`, `file_name varchar(80)`, `created_at` |

Indexes: `contribution_phases (state)`; `contribution_uploads (user_id, created_at)` (daily limit),
`(phase_id, user_id, kind)` (counts); `contribution_forms (phase_id, user_id)`; a partial unique index so at most one
phase is `open`.

Atomic form: files are written to a temp folder, then the rows are inserted in one transaction, then the folder is
moved into place; on any failure the temp folder is deleted and nothing is recorded.

### Backend API

App (signed-in, not suspended — the existing guard):

| Method | Route | |
|---|---|---|
| GET | `api/Contribution` | `{ serverNow, enabled, reason, phase, latestResult }` — `phase` is null when off / paused; vote: `{ id, kind, openedAt, endsAt, candidates:[{id, name, description}], myVote:{candidateId, text}\|null }`; photo: `{ id, kind, openedAt, endsAt, subject:{name, description}, mine:{detectionPhotos, classificationForms}, limits:{perUpload:20, formMin:5, formMax:10, dailyLeft} }`; names in the user's language with English fallback |
| PUT | `api/Contribution/Vote` | `{ phaseId, candidateId, text }` → upsert |
| POST | `api/Contribution/Detection` | multipart `phaseId`, `images[]` (1–20) → updated `mine` |
| POST | `api/Contribution/Classification` | multipart `phaseId`, `images[]` (5–10) → updated `mine` |
| GET | `api/Contribution/Examples` | `{ detection:[fileName], classification:[fileName] }` |
| GET | `api/Contribution/Examples/{form}/{fileName}` | the image (strict name pattern, `nosniff`, cache 1 hour) |

Every write checks: the switch is on, `phaseId` is the active phase, it is open and its end date has not passed, the
phase kind matches. Errors use the app's error-key style (`contributionClosed`, `contributionDailyLimit` with reset
time, `formPhotoCount`, `voteTextLength`, …). Request size limit 40 MB on the upload routes.

Admin (`api/Admin/Contribution/*`, each change audited `contribution.settings|create|update|close|interrupt|winner|delete`):

| Method | Route | |
|---|---|---|
| GET / PUT | `Settings` | `{ enabled, reason, activePhaseId }`; PUT enforces the rules above and opens a draft |
| GET | `Phases?kind&state` | list with summary (candidates or subject, dates, totals) |
| GET | `Phases/{id}` | detail: vote → candidates with counts and percentages, tie flag; photo → totals, folder path |
| GET | `Phases/{id}/Texts?candidateId&page` | free texts, 50 per page, newest first: candidate, text, date (no user names) |
| POST | `Phases` | create draft `{ kind, endsAt?, candidates? \| sourcePhaseId }` |
| PUT | `Phases/{id}` | draft: everything; open: `endsAt` only |
| POST | `Phases/{id}/Close`, `Phases/{id}/Interrupt` | `{ reason? }` (reason required when it is the active phase) |
| POST | `Phases/{id}/Winner` | `{ candidateId }` — closed voting phase **without** a winner only (tie or no votes); tie → one of the tied candidates |
| DELETE | `Phases/{id}` | draft only |

### Activity

Recorded with `IActivityLog.Record` in the same save as the action (as every other action):

| kind | when | details |
|---|---|---|
| `contribution.voted` | first vote in a phase | `{ phaseId, candidate }` (candidate name at the time) |
| `contribution.voteChanged` | vote or text changed | `{ phaseId, candidate, previousCandidate }` |
| `contribution.photosUploaded` | a detection upload | `{ phaseId, subject, count }` |
| `contribution.formCompleted` | a classification form | `{ phaseId, subject, count }` |

- New category **`contribution`** in `ActivityKinds` → a new "Shape What's Next" sub-page in Settings › My activity
  (en + hu sentences: "You voted for Stamps", "You uploaded 12 photos for Stamps", "You completed a 7-photo form for
  Stamps"); tapping opens `community/shape`. No target id is needed, so `ActivityTargets` stays as it is.
- Stats & facts: they count towards **active users per week** only (decided by your human partner). **Collector of the
  week** ignores every `contribution.*` entry (one filter in `CommunityStatsService`), and they don't count as
  "interactions" or "items added".

### Account deletion

Deleting an account deletes that user's votes (and free texts), forms, uploads and their files in every phase. A
closed voting phase keeps its stored winner; its counts shown afterwards reflect the remaining votes.

### Manager — Contribution tab

```
[Contribution ▾]                                                    Signed in as … · Sign out
┌ Switch ───────────────────────────────────────────────────────────────────────────────────┐
│ (•) On  ( ) Off    Active phase [Vote: Coins / Stamps / Pins — open ▾]   Reason [ … ▾ ]   │
│ Phone shows: "3 d 14:22 left — Vote: Coins / Stamps / Pins"                       (Save)  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
┌ Phases  [All kinds ▾][All states ▾] ┐ ┌ Vote: Coins / Stamps / Pins — open ────────────────┐
│ Vote  Coins/Stamps/Pins  open  12/10│ │ Ends [2026-12-10 20:00] (+1 day)(+7 days)(Save)   │
│ Photo Stamps             closed     │ │ Coins   ▓▓▓▓▓░░░░░  41 %  52                       │
│ Vote  Stamps/Pins/Coins  closed ★   │ │ Stamps  ▓▓▓▓░░░░░░  35 %  44                       │
│ (New voting phase) (New photo phase)│ │ Pins    ▓▓▓░░░░░░░  24 %  30                       │
│                                     │ │ Texts [All candidates ▾]                           │
│                                     │ │  Coins · 11/27 · "Year, mint mark, metal…"         │
│                                     │ │ (Close now) (Interrupt…)                           │
└─────────────────────────────────────┘ └────────────────────────────────────────────────────┘
```

- **Switch panel:** On / Off; Active phase (drafts and open phases; "New…" creates one); Reason (only when Off); a
  one-line preview of what the phone shows; Save.
- **Phase list:** kind, label (vote: the three names; photo: the subject), state ("open (paused)" when not active),
  end date, totals; ★ marks the most recent closed voting phase with a winner.
- **Vote detail:** draft → candidate editor (name, description, the two JSON boxes) and end date; open / closed /
  interrupted → counts with bars and percentages, tie banner with "Pick winner", free texts filterable by candidate
  and paged.
- **Photo detail:** source voting phase picker (draft only; closed with winner, newest first, most recent preselected
  and marked); end date; totals; storage folder path (copyable).
- **End date:** entry `YYYY-MM-DD HH:MM` in local time (stored UTC) plus "+1 day" / "+7 days" buttons.
- **Actions:** Save, Close now, Interrupt… (asks for confirmation and, for the active phase, the reason), Pick winner,
  Delete (drafts).

### App — Shape What's Next

Routes: `community/shape` (the hub, replaces "coming soon"), `community/shape-detection`,
`community/shape-classification`; an example gallery modal shared by both.

**Off / paused** — illustration icon, "No contribution period right now", the reason, then the Latest result card (when
one exists). Pull to refresh.

**Voting open:**

```
┌ Shape What's Next ─────────────────────┐
│ Vote: what should come next?           │
│ 3 d  14:22:07   ▓▓▓▓▓▓▓░░░░  ends 12/10│
│ ( ) Coins     – short description      │
│ (•) Stamps    – short description      │
│ ( ) Pins      – short description      │
│ Which attributes would you like, and   │
│ why would it be good?                  │
│ [ free text…                  0/1000]  │
│               (Send vote)              │
└────────────────────────────────────────┘
```
After voting: "Your vote: Stamps" with the text and an "Edit vote" button.

**Photo phase open:**

```
┌ Shape What's Next ─────────────────────┐
│ Help us teach Coffer: Stamps           │
│ 9 d  03:41:55   ▓▓▓░░░░░░░  ends 12/20 │
│ ┌ Object detection ──────────────────┐ │
│ │ You uploaded 34 photos             │ │
│ │ (Guidelines) (Examples) (Upload)   │ │
│ └────────────────────────────────────┘ │
│ ┌ Classification ────────────────────┐ │
│ │ You completed 3 forms              │ │
│ │ (Guidelines) (Examples) (New form) │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

- **Detection screen:** guidelines (collapsible, open the first time), Examples, Camera / Gallery buttons, thumbnail
  grid with remove, "Send N photos" with progress; success toast and the updated count.
- **Classification screen:** guidelines, Examples, a 10-slot grid "N of 5–10 photos", Camera / Gallery, "Complete form"
  enabled from 5 photos; success → "Form completed" and a fresh empty form; back with photos → discard confirmation.
- **Example gallery:** a grid of the form's example images; tap → full screen (pinch zoom), swipe or arrows between
  images, close button.
- **Countdown:** from `endsAt` corrected by `serverNow` (phone clock skew); ticks every second; tabular figures; at zero
  the page refetches and shows the closed state. Progress bar = elapsed share of `openedAt → endsAt`, with
  `accessibilityRole="progressbar"` and a value. Screen readers get one label ("3 days 14 hours 22 minutes left") on
  focus, not a live announcement every second.
- UI quality (ui-ux-pro-max checklist): touch targets ≥ 48 dp; primary action one per screen; loading states on every
  button that sends; error states with retry; empty states; reduced motion (no animated bar fill); colour never the only
  signal (counts and percentages printed); both themes checked.

## Calls made while writing this up (your human partner can overturn them)

1. Candidates have name + description, both with translations (JSON boxes as in item types).
2. Free text required, 10–1000 characters; vote and text changeable until close; counts hidden from users while open;
   Latest result card (winner + shares) after close.
3. A clear leader wins automatically; only a tie or no votes goes to the admin's "Pick winner"; a stored winner never
   changes.
16. Several photo phases may come from one voting phase; the Manager shows "used by N photo phase(s)".
4. Closing by date (or Close now) switches the contribution off with reason "one just finished"; Interrupt asks for
   the reason.
5. Only one open phase at a time; a draft needs an end date ≥ 5 minutes ahead to open; candidates locked once open.
6. 1–20 photos per detection upload; classification form sent in one request, all-or-nothing; discard confirmation.
7. 300 contribution photos per user per UTC day.
8. Server safety net mirrors the phone's width rule per upload (800 px for item photos, covers and contributions;
   1600 px for listing and shipping/receipt photos); a photo carrying metadata is re-encoded even when small enough.
9. Listing and shipping/receipt photos get a phone resize of 1600 px wide, JPEG 0.8 (enough to judge an item's
   condition); photos already stored are untouched.
10. The detection guideline's hard-negative examples become a general phrase (a coin may be the next item type).
11. Free texts shown to the admin without user names.
12. Account deletion removes the user's votes, texts and photos.
13. Activity: one entry per action (an upload of 20 photos is one entry with the count in its details); a new "Shape
    What's Next" category in My activity; tapping an entry opens Shape What's Next.
14. Production storage is a named Docker volume; copying files in and out is documented in the README.
15. The example gallery folder is read on request (cached 1 minute); filename order.

## Testing

- Backend (xUnit, SQLite + API tests): state machine and switch rules (enable opens a draft, pause, one open phase,
  close by date evaluated on read, sweep persists and switches off), vote upsert and text length, winner / tie / no
  votes, photo phase needs a closed vote with winner, uploads refused when off / paused / closed / wrong kind, 20 / 5–10
  limits, daily limit with reset, atomic form (failure leaves no rows and no files), activity entries recorded per
  action (and none for a refused one), safety net per upload path (an app-sized photo is stored byte-for-byte; an
  oversized one is resized to the path's width; one with EXIF / GPS is re-encoded without it), examples listing and
  strict file names, admin endpoints admin-only and audited, account deletion cleans contribution data.
- Manager (unittest): API client, switch-panel validation, end-date parsing (local ↔ UTC), "most recent" selection,
  JSON boxes.
- App: countdown with clock skew, form count rules, the off / vote / photo states, en + hu keys complete.
- Device check: run a voting phase and a photo phase end to end on the phone, confirm files land in the folder layout,
  and that an uploaded photo has no GPS.

## Left to the builder

- Exact component split, colours from the theme, icons (MaterialCommunityIcons as elsewhere), illustration on the off
  page.
- Tkinter widget layout details; polling of the Manager detail (manual refresh is fine).
- Whether the close sweep lives in the marketplace maintenance loop or a sibling hosted service.
- Hungarian wording of the guideline texts (same tone as the app's other Hungarian texts).
