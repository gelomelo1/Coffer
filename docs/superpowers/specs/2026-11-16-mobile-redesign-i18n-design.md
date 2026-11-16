# Coffer Mobile — Retro Redesign, Rich Text, Country Picker & i18n

Date: 2026-11-16 · Scope: `src/Coffer/Coffer.ReactNative` only · Source request: `instructions.md` (redesign + §8)

## Intent

Coffer should feel like a carefully designed retro mobile app: same navy/gold/cream identity, square corners, visible
borders, but calmer, roomier, easier to scan and comfortable on every phone size. At the same time every
application-controlled string moves into `react-i18next` English JSON files so a second language is "add a folder",
not "edit 150 components". No existing feature, workflow or API integration may be lost.

## Goals

- One shared component set with one visual language used by every screen (no per-screen variants of the same control).
- Every screen, dialog, sheet, list and form reviewed and redesigned for its own purpose — not one generic card.
- Rich text editor (collection description, user bio) restyled; its toolbar sits flush on top of the keyboard on every
  phone size.
- Country picker (register, settings, market filter) restyled to Coffer.
- All static user-facing text (labels, placeholders, validation, API error feedback, toasts, empty states,
  confirmations, accessibility labels, terms text) served by i18next; English default + fallback.
- Works on narrow (≈320dp) to large (≈480dp) phones, tall aspect ratios, large font scale, with keyboard open.

## Non-goals

- New features, backend/API changes, business-logic changes.
- Dark mode (the app is light-only today; stays light-only).
- A second language (structure only; English is the single shipped locale).
- Replacing `@10play/tentap-editor`, `react-native-country-picker-modal` or `react-native-dropdown-picker`.
- iOS device testing (no `ios/` project, Windows host). iOS-specific code is written where needed but only Android is
  run.

## Anti-goals (failure even if it "works")

- Rounded/soft UI, gradients, glass, a stock Material look, decorative shadows.
- Any feature/action/option removed or made harder to find.
- Translated or altered user content (descriptions, bios, comments, usernames, item data, moderation statements).
- Translated backend identifiers / enum values / API property names.
- Sentences built by concatenating translated fragments.

## Constraints

- Colors unchanged: primary `#19283f` (navy), secondary `#a98d3c` (gold), background `#fefdf0` (cream), accent
  `dimgray`, overlay `rgba(0,0,0,0.5)`. Fonts: VendSans family (already bundled).
- Expo SDK 54, RN 0.81, new architecture, expo-router, Android edge-to-edge enabled, React Compiler on.
- Keep navigation structure (expo-router stacks + bottom tabs), zustand stores, react-query hooks, image caching.
- Only new dependencies: `i18next`, `react-i18next` (required by the request). `react-native-localize` is already
  installed and is reused for device-language detection.
- Git: commit per milestone on the current `development` branch, no AI co-author trailers, never push.

## Approaches (considered, picked by Claude — user delegated the "how")

1. **Foundation first, then area-by-area passes — PICKED.** Build tokens, shared components, i18n setup, editor and
   country picker; then redesign + extract strings area by area (auth → home/feed/search → collections → items →
   market → comments → settings/reports/other user), verify on Android, commit each. Every file is touched once.
2. i18n sweep first, then redesign sweep — every file edited twice; JSX churn conflicts. Rejected.
3. Restyle shared components only — fast, but crowded layouts and hardcoded strings live in the screens; does not meet
   the request. Rejected.

## Decided by the user

- **Shadow rule "B":** the hard offset shadow (`3px 3px` navy, no blur) appears **only on pressable elements**
  (buttons, chips, FAB, tappable tiles). Pressed state collapses the shadow (element visually "sinks": translate by the
  offset, shadow 0). Cards, inputs, sheets and list rows are flat with a 2px border.
- iOS-specific code where needed, not tested; Android tested.
- Use Superpowers workflows and UI UX Pro Max throughout.

## Design direction (UI UX Pro Max)

The style search lands on **Neubrutalism** (hard borders, hard offset shadows, 0px corners, flat fills, bold type)
combined with **Flat Design** (no gradients, solid fills, minimal ornament) — restrained to Coffer's own palette rather
than neubrutalism's saturated pops. Guidelines applied from the dataset: 48dp touch targets, 8dp+ gaps between targets,
4/8 spacing rhythm, 16px body text, visible labels above inputs, errors under the field, one primary action per screen,
destructive actions in danger color and spatially separated, FlatList for long lists, Pressable with press feedback,
safe-area insets on fixed bars, support for system font scaling, clear close affordance on every modal/sheet.

### Contrast (measured, WCAG)

| Pair | Ratio | Use |
|------|-------|-----|
| navy on cream | 14.5 | all body text |
| navy on gold | 4.6 | text on gold buttons/headers/selected chips ✔ |
| cream on navy | 14.5 | text on navy buttons/tags ✔ |
| gold on navy | 4.6 | icons/text on navy ✔ |
| cream on gold / gold on cream | 3.1 | **large text, icons, borders only** — never body text |
| dimgray on cream | 5.4 | muted/meta text ✔ |
| `red` on cream | 3.9 | ✘ replaced by danger `#b3261e` (6.4) |
| success `#2e7d32` on cream | 5.0 | success text ✔ |

### Tokens (`src/theme/theme.ts`, extended — existing `customTheme.colors` keys kept for compatibility)

- **Color roles:** `bg` cream · `surface` cream · `surfaceAlt` = cream darkened ~4% (tinted rows, read-only fields) ·
  `text` navy · `textMuted` dimgray · `onPrimary` cream · `onSecondary` navy · `border` navy · `borderMuted` navy @
  25% (hairline separators) · `danger` `#b3261e` · `success` `#2e7d32` · `overlay` `rgba(0,0,0,0.5)`.
- **Spacing:** 4, 8, 12, 16, 24, 32, 48. Screen gutter 16; section gap 24; in-card gap 12; control gap 8.
- **Type (VendSans):** caption 12/16 · meta 14/20 · body 16/24 · bodyStrong 16/24 bold · title 18/24 bold ·
  headline 22/28 bold · display 28/34 bold. Uppercase + letter-spacing 0.5 only for tags and section eyebrows.
- **Borders:** 2px standard, 1px hairline (separators), 3px focus. Radius 0 everywhere.
- **Shadow:** `3px 3px 0 navy` (pressables only), `0` when pressed/disabled.
- **Sizes:** control height 48 (md) / 40 (sm, only in dense toolbars with hitSlop to 48) · icon 20/24/32 · min touch 48.
- **Font fix (Claude's call, veto-able):** body text uses `fontFamily: "VendSans"`, but the font is registered as
  `VendSansRegular`, so every regular-weight text currently falls back to the system font. Fix: register/use
  `VendSansRegular` everywhere — body text will render in VendSans as originally intended.

## Shared components (in `src/components/custom_ui/`, rewritten in place)

Names and props are preserved where call sites depend on them; internals drop `react-native-elements` for plain RN
primitives. `market/ui/retro.tsx` primitives (SectionCard, Chip, Tag, EmptyState, StarRating, WarningBanner…) are
moved into the shared set and re-exported from `retro.tsx` so existing imports keep working.

- **Text** (`CustomText`) — `variant` prop mapped to the type scale; foldable "Read more" kept.
- **Button** (`CustomButton`) — variants `primary` (navy fill, cream text), `secondary` (gold fill, navy text),
  `outline` (cream fill, navy border/text), `danger` (danger fill), `ghost` (text-only, no shadow); sizes md/sm;
  `loading`, `disabled` (50% opacity, no shadow, `accessibilityState.disabled`), optional leading icon; label wraps
  to 2 lines rather than clipping.
- **IconButton** — 48×48 hit area, `accessibilityLabel` required.
- **TextField** (`CustomTextInput`) — label above (bold 14), field 48 min height, 2px navy border, cream fill;
  focus → 3px gold border; error → danger border + message below + `accessibilityLiveRegion`; helper text below;
  disabled → 50% opacity; **read-only** → `surfaceAlt` fill, no border, value in body text (distinct from disabled);
  multiline grows to a max height then scrolls; correct `keyboardType`, `autoCapitalize`, `textContentType`,
  `returnKeyType`/`onSubmitEditing` focus chaining. Search variant with leading search icon + clear button.
- **Select** (`CustomDropdown`, `CustomDropdownMultiple`, `CustomAutocomplete`) — keep `react-native-dropdown-picker`,
  theme it to TextField look; MODAL list mode on narrow screens / long lists so it never clips inside scroll views.
- **Card / SectionCard** — flat, 2px border, 16 padding, optional header row (title + action).
- **ListRow** — 56+ min height, leading media, title (wraps 2 lines), meta line, trailing chevron/action; hairline
  separators between rows.
- **Chip** (filters/options) — pressable shadow rule; selected = gold fill + bold; wraps in rows, never horizontal
  overflow except in explicitly scrollable chip rails.
- **Tag** — small status label, uppercase, color + text (never color only).
- **Overlay / Sheet / Dialog** (`CustomOverlay`, `CustomOverlayMessage`) — full-width bottom sheet on phones with a
  header bar (title + close IconButton), safe-area bottom padding, keyboard-aware body; confirm dialog with
  destructive button separated and in danger color.
- **States** — Loading (inline spinner + optional text; skeleton blocks for feeds/lists), EmptyState (icon, title,
  text, optional action), ErrorState (message + Retry), Toast themed (square, bordered, success/error/info icons).
- **Screen** — safe-area aware container (top inset under custom headers, bottom inset above tab bar/CTA bars),
  replaces `rootViewStyle`'s inset-shadow frame with a clean 16dp gutter.
- **Header & tab bar** — header: gold bar, title (headline, single line w/ ellipsis + accessibility full text),
  back IconButton on the left (platform convention; currently on the right). Tab bar: cream bar, 2px navy top border,
  icon + label, active tab = gold indicator block + bold label; FAB keeps its place, square, pressable shadow.

## Screen-by-screen direction (builder evaluates each against its purpose)

List layout rule: **image-dominant content → cards/grids** (feed, items, listings, collections); **text-dominant
content → rows** (chats, deals, follows, comments, reviews, reports, settings). Long collections use FlatList /
SectionList with stable keys and memoized rows.

- **Auth** (login, register, dev login, suspended screen): single-column, logo/hero top, one primary action; register
  form uses TextField + CountryField.
- **Home feed + search overlay**: feed cards with image first, title, owner row, reactions/comments row with 48dp
  targets; search overlay with segmented scope (items / collections / users) and row results.
- **Collections tab, my collection, collection info/edit/delete, item list, filters bottom sheet**: collection grid
  cards; item list keeps its existing layout modes; filter sheet grouped with section headers and a sticky
  "Apply / Reset" bar.
- **Item details, item edit (all dynamic attribute fields), item register flow (overlay, image picker, collection
  select)**: details as labeled attribute rows (label above value on narrow screens), edit form with grouped fields,
  sticky save bar; image picker/camera sheets with large targets.
- **Market** (browse, listing card, filters, listing details, listing form, my listings, chats, chat, composer,
  message bubbles, deals, deal panel, PIN, shipping, reviews, terms gate, reports): listing cards in a 2-column grid
  on ≥360dp, 1 column below; chat rows; bubbles stay square with border; deal panel as stepper-like status card.
- **Comments** (section, overlay, composer, body): threaded rows with indentation capped for narrow screens.
- **Settings** (index, user, developer, reports), other user, other user collection/item: settings as grouped
  ListRows; user info card with read-only vs edit distinction; contacts list rows.

## Rich text editor (`custom_rich_text_editor.tsx`, tentap)

- Theme via `useEditorBridge({ theme })`: toolbar body cream with 2px navy top border, buttons 48×44, icons navy
  `tintColor`, active = gold background, disabled = 30% opacity, link bar input + "Done" button in Coffer style,
  0 radius. Editor content CSS: VendSans-like stack, 16px/1.5, 12px padding, placeholder muted. Read-only render
  (`custom_html_view.tsx`) matches the editor's typography so edit and view look the same.
- Editor frame: 2px border, label above, focus → gold border; height from a prop with a sensible min (≈160) and the
  rest of the form remains scrollable.
- **Toolbar positioning:** drop the hard-coded `keyboardVerticalOffset={98}`. The toolbar is rendered absolutely and
  its `bottom` is computed from the real keyboard: subscribe to keyboard show/hide (`keyboardWillShow/Hide` on iOS,
  `keyboardDidShow/Hide` on Android), read `endCoordinates.screenY`, `measureInWindow` the host view, and set
  `bottom = hostBottom − keyboardTop` (clamped ≥ 0), accounting for edge-to-edge (Android window not resized) and
  iOS bottom safe area. Hidden when keyboard is down or editor unfocused (library behavior kept). Verified on several
  emulator sizes.
- Toolbar item set: tentap default items with labels for accessibility (`accessibilityLabel` from i18n where the API
  allows; custom `items` array if needed).

## Country picker (`CountryField` wrapper, used in register, settings, market filter)

- One wrapper component replaces the three direct usages. Trigger looks like a TextField (label above, flag + country
  name wrapping to 2 lines, chevron).
- Picker themed via `theme` (navy text, cream background, VendSans, 56 item height, gold variant), custom filter
  (`renderCountryFilter`) styled as the search TextField with translated placeholder, custom close button
  (IconButton look), `preferredCountries` puts the current selection first, `flatListProps` for hairline separators
  and keyboard-dismiss on drag, `withCallingCode` where it was shown before. Uses library `translation` prop
  (`common` / English) so names follow the app language later.

## Internationalization (`react-i18next`)

- Location: `src/i18n/index.ts` (init, called once via side-effect import at the top of `src/app/_layout.tsx`) and
  `src/i18n/locales/en/<namespace>.json`. Namespaces: `common`, `navigation`, `auth`, `feed`, `collections`, `items`,
  `market`, `comments`, `settings`, `validation`, `errors`, `notifications`, `accessibility`.
- Language: device language via `react-native-localize`, resolved against available resources; `lng` fallback and
  `fallbackLng` = `en`. Missing keys log in `__DEV__` and render the English fallback.
- Usage: `useTranslation(ns)` in components; `i18n.t` exported for non-React code (validation, error mapping,
  label maps in `const/market.ts` etc. become key maps or functions resolved at render time so language changes
  re-render).
- Interpolation for dynamic values, i18next plural suffixes (`_one` / `_other`) for counts, `<Trans>` only where
  inline styling inside a sentence is needed. Typed keys via `CustomTypeOptions` so typos fail type-check.
- **Backend errors:** a single `mapApiError(error)` helper maps HTTP status + known `code` values (e.g.
  `account_suspended`, `terms_required`, 401/403/404/409/413/429/5xx, network/timeout) to `errors.*` keys; arbitrary
  backend English text is not shown when a frontend message exists. Moderation statements, suspension reasons and
  other admin/user-written text are user content → shown untouched.
- Not translated: user content, usernames, enum/identifier values, dates' raw data (formatted with locale-aware
  helpers instead).
- Completeness check after each area: grep the area for JSX text nodes and string literals in user-facing props
  (`title`, `label`, `placeholder`, `text1/text2`, `accessibilityLabel`, `Alert.alert`); final sweep over all of `src`.

## Testing

- Every milestone: `npx tsc --noEmit`, `npx expo lint`, run on the Android emulator against the dev backend
  (`docker compose -f docker-compose.dev.yml up`, dev login with seeded users), walk the touched area's workflows.
- Device matrix via `adb shell wm size/density` on the running emulator: small 360×640dp, narrow 320dp-wide,
  standard (Pixel 7, 412dp), tall 20:9, large 480dp-wide; plus `font_scale 1.3`; keyboard open on every form.
- Rich text: focus editor on each size, screenshot, confirm toolbar top edge = keyboard top (no gap/overlap), link bar,
  heading context, scroll while typing. Country picker: open, search with keyboard up, pick long name, narrow width.
- Final full walkthrough of every screen + final hardcoded-string sweep; issues found are fixed, not just listed.

## Left to the builder

- Exact per-screen layouts within the rules above, file splits, which existing components merge.
- Skeleton vs spinner per screen; animation details (subtle, ≤200ms, respects reduce-motion).
- Translation key naming within the namespace scheme.
- Whether `react-native-elements` / `react-native-paper` imports can be removed entirely (dependencies stay installed).
