# News — design

## Intent

Coffer gets a place for announcements and stories. Administrators write news posts in Coffer.Manager — a hero banner,
a title and markdown content with images and links — and users read them in the Community tab's **News** page. Links in
a post can open pages inside the app ("app links"), and the app gets a "Copy app link" action so an administrator can
grab the link of any item, listing, collection or profile while browsing.

## Goals

- **App — News list**: published posts, newest first, 20 per page; each card shows a section of the hero banner (if
  any), the title and the published date; tapping opens the post.
- **App — News post**: hero banner, title, published date (and "edited" when changed after publishing), the markdown
  content rendered natively; images inline; app links open the page, web links open the browser.
- **Manager — News tab**: list of posts (drafts and published), editor with title, hero banner upload, markdown code
  view + live rendered view, a formatting toolbar with every common option, image upload into the content, an "Insert
  app link" picker; save draft, publish / unpublish, delete.
- **App — Copy app link** on item, listing, collection and profile screens.
- English + Hungarian app texts (post content itself is written in whatever language the admin writes).

## Non-goals

- Comments, likes or push notifications on news.
- Scheduled publishing, per-language versions of a post.
- Raw HTML in posts (never rendered).

## Anti-goals

- A post that runs code or loads HTML / scripts in the app or the Manager.
- A draft visible to users (or reachable by id).
- An app link that crashes or opens the wrong page; a link to something deleted or hidden must say so, not break.

## Approaches (rendering in the app)

| | How | Trade-off |
|---|---|---|
| **A — native markdown renderer (chosen)** | `@ronradtke/react-native-markdown-display@8.1.0` (pure JS: markdown-it, no native code) renders to native views styled with the theme; custom image and link rules. | One new pure-JS library; fast, accessible, no HTML. |
| B — WebView with server HTML | Backend makes sanitized HTML, the app shows it in a WebView. | Slower, nested scrolling, weaker a11y, sanitizer becomes security-critical. |
| C — server block tree | Backend parses to JSON blocks, app renders its own components. | Most code for the same result. |

Your human partner picked **A**.

## Decided by your human partner

1. Posts: draft → publish when ready → edit later (published keep their date, show "edited") → delete (A).
2. App links as recommended (`coffer://…`, inserted with a picker in the Manager), plus **Copy app link** in the app.
3. Approach A.

## Design

### Data

Table `news_posts` (migration `src/startup/news_migration.sql`):

| column | |
|---|---|
| `id uuid` | |
| `title varchar(120)` | required, 1–120 |
| `hero_image varchar(80) NULL` | file name in the news image store |
| `content text` | markdown, ≤ 50 000 characters |
| `status` | `draft` \| `published` |
| `created_at`, `updated_at` | |
| `published_at NULL` | set on the **first** publish; kept when republished after an unpublish |
| `edited_at NULL` | set when content / title / banner change while published |
| `created_by`, `updated_by uuid` | Manager admin ids (also in the admin audit log) |

Index (`status`, `published_at desc`).

### Images

Stored under `IMAGESTORE_PATH/news/` (existing image volume). Uploads (banner and content images): PNG / JPEG / WebP by
magic bytes, ≤ 8 MB, re-encoded with ImageSharp to JPEG (quality 85, longest side ≤ 1600 px; PNG stays PNG when it has
transparency), metadata stripped, named `{guid}.jpg|png`. Served by `GET api/News/Image/{fileName}` (anonymous, strict
name pattern, `nosniff`, long cache). Content images are referenced as `![alt](coffer-image:{fileName})` in markdown;
the app and the Manager turn that into the image URL. Deleting a post deletes its banner and the content images no
other post references.

### App links

Format `coffer://{target}` (never a real web URL):

| Link | Opens |
|---|---|
| `coffer://item/{id}` | item page (`openItem`) |
| `coffer://collection/{id}` | collection page (own → editor, other → their collection) |
| `coffer://listing/{id}` | listing details (`openListing`) |
| `coffer://user/{id}` | profile |
| `coffer://news/{id}` | that news post |
| `coffer://home`, `coffer://collections`, `coffer://follows`, `coffer://community`, `coffer://community/stats`, `coffer://community/news`, `coffer://market`, `coffer://settings` | that tab / page |

`https://` links open the browser (after the system's handling); `mailto:` opens mail; anything else (other schemes,
malformed ids) shows "This link can't be opened". A target that is gone or hidden shows the existing "not found" toast
of the page it would open.

**Copy app link**: a "Share" icon button (`share-variant`) in the header area of item details, listing details,
collection and profile pages opens the system share sheet with the app link (Android's sheet has **Copy**). Pure
React Native `Share` — no new native module.

### Backend API

Admin (`ManagerControllerBase`, every change audited `news.create|update|publish|unpublish|delete|image`):

| Method | Route | |
|---|---|---|
| GET | `api/Admin/News?status&page` | drafts and published, newest updated first |
| GET | `api/Admin/News/{id}` | full post |
| POST | `api/Admin/News` | create draft `{title, heroImage, content}` |
| PUT | `api/Admin/News/{id}` | edit (sets `edited_at` when published) |
| POST | `api/Admin/News/{id}/Publish` | `{published}` |
| DELETE | `api/Admin/News/{id}` | deletes post and its unshared images |
| POST | `api/Admin/News/Images` | multipart `file` → `{ fileName }` |
| GET | `api/Admin/News/LinkTargets?type&query` | top 20 matches for the picker: users (name), collections (name, owner), items (primary value, collection), listings (title) — tombstoned / hidden types excluded |

App (signed-in users): `GET api/News?page&pageSize` → `{ items: [{ id, title, heroImage, publishedAt, editedAt }] }`
published only, `published_at desc`; `GET api/News/{id}` → full post or 404 (drafts and unknown ids alike).

Validation: title 1–120; content ≤ 50 000; `heroImage` and every `coffer-image:` name must exist in the store.

### Manager — News tab (Tkinter, report-view style)

```
[News ▾]                                                       Signed in as … · Sign out
┌ Posts ─────────────────┐ ┌ Editor ───────────────────────────────────────────────────┐
│ ● Coffer 2.0 published │ │ Title [Coffer 2.0 is here                               ]  │
│ ○ Winter swap   draft  │ │ Banner [img] (Upload banner…) (Remove)                    │
│ (New post)             │ │ B I S | H1 H2 H3 | • 1. ❝ | ` {} | — ⊞ | 🔗 App link 🖼     │
│                        │ │ ┌ Markdown ───────────────┐ ┌ Preview ──────────────────┐ │
│                        │ │ │ # Coffer 2.0            │ │ Coffer 2.0 (big)           │ │
│                        │ │ │ We added **news**…      │ │ We added news…             │ │
│                        │ │ └─────────────────────────┘ └────────────────────────────┘ │
│                        │ │ Draft · last saved 12:03   (Save) (Publish) (Delete)       │
└────────────────────────┘ └────────────────────────────────────────────────────────────┘
```

- Toolbar (text buttons with tooltips, keyboard shortcuts Ctrl+B / Ctrl+I / Ctrl+K): bold, italic, strikethrough,
  heading 1–3, bulleted list, numbered list, quote, inline code, code block, horizontal rule, table (2×2 template),
  web link (dialog: text + URL), **app link** (dialog: kind → search → pick; or a fixed page), **image** (file dialog
  → upload → inserts `![](coffer-image:…)` at the cursor). Buttons wrap the selection or insert at the cursor.
- Preview: markdown-it (HTML disabled) tokens drawn into a read-only Text widget with tags (headings, bold, italic,
  strikethrough, code, quote, lists, rule, tables as aligned rows, links underlined, images loaded via the API as
  thumbnails); refreshed 300 ms after typing stops.
- Unsaved-changes guard when switching posts or leaving the tab.

### App screens

- **News list** (`community/news`): replaces "coming soon". Cards: banner band (16:9 crop, ~40 % of the card) when there
  is a banner, else a coloured band with a newspaper icon; title (2 lines); date ("Nov 23, 2026" / "2 days ago");
  pull to refresh, infinite scroll, empty state ("No news yet").
- **News post** (`community/news-post`, post id in a store like other detail pages): full-width banner, title
  (display), date line, markdown body styled with the theme (headings, paragraphs, lists, quotes, code blocks
  monospace on surfaceAlt, rules, tables, images full width with aspect from the image, links underlined in primary).

## Calls made while writing this up (your human partner can overturn them)

1. "Copy app link" uses the system share sheet (it has Copy) — a direct clipboard needs `expo-clipboard`, a native
   module, and therefore a new development build.
2. News images live in the existing image store (`IMAGESTORE_PATH/news`), not a new volume.
3. Republishing after unpublish keeps the original published date.
4. App links use `coffer://` (not the app's install scheme) — they only work inside posts and are never opened by the OS.
5. Library pinned to `@ronradtke/react-native-markdown-display@8.1.0` (9.x adds a native icon package).
6. The share button is shown to every user (sharing a link is harmless; it is also how the admin copies one).

## Left to the builder

- Tkinter preview details, exact toolbar glyphs, dialog layout.
- Markdown rule styles within the theme.
