# Coffer Mobile Redesign + i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign every screen/component of the Coffer React Native app in a consistent, roomier retro style, restyle the
rich text editor (toolbar on the keyboard) and country picker, and serve all static text through react-i18next.

**Architecture:** Foundation first (tokens → shared components → i18n → editor → country field → error mapping), then
one pass per app area that redesigns its screens and extracts its strings together, each verified on the Android
emulator and committed. Shared components are rewritten in place under `src/components/custom_ui/` keeping the props
call sites use, so areas can migrate one at a time.

**Tech Stack:** Expo SDK 54, React Native 0.81 (new arch, React Compiler), expo-router, zustand, react-query,
@10play/tentap-editor, react-native-country-picker-modal 2.0, react-native-dropdown-picker, i18next + react-i18next,
react-native-localize. Node 24 `node --test` for pure-logic tests and checker scripts.

**Spec:** `docs/superpowers/specs/2026-11-16-mobile-redesign-i18n-design.md`

All paths below are relative to `src/Coffer/Coffer.ReactNative/` unless they start with `docs/` or `src/Coffer/`.

## Global Constraints

- Colors unchanged: primary `#19283f`, secondary `#a98d3c`, background `#fefdf0`, accent `dimgray`, overlay `rgba(0,0,0,0.5)`.
- Radius 0 everywhere. Borders 2px standard, 1px hairline, 3px focus. No gradients, no blur, no decorative shadows.
- Hard shadow `3px 3px 0px #19283f` only on pressables; collapses (shadow 0 + translate 3,3) while pressed; none when disabled.
- Danger `#b3261e`, success `#2e7d32`; never pure `red`. Gold on cream / cream on gold only for icons, borders, ≥18px bold text.
- Touch targets ≥ 48dp (use `hitSlop` when the visual is smaller); ≥ 8dp between adjacent targets.
- Fonts: `VendSansRegular`, `VendSansSemiBold`, `VendSansBold`, `VendSansItalic` (the literal `"VendSans"` must not remain).
- Only new dependencies: `i18next`, `react-i18next`. No backend changes. No feature/action removed.
- i18n call convention: `const { t } = useTranslation();` and keys always fully qualified `t("ns:path.to.key")`; outside
  React use `i18n.t("ns:…")` from `src/i18n`. English default + fallback. Plurals `_one`/`_other`. No concatenated sentences.
- Never translate user content (descriptions, bios, comments, usernames, item/attribute values, moderation statements,
  suspension reasons) or enum/identifier values.
- `Platform.OS === "ios"` branches are written where behavior differs; only Android is run.
- Commits: on branch `development`, no `Co-authored-by` trailer, never push.

## Review Focus

1. **320dp width + font scale 1.3** — button labels, headers, chips, tags and tab labels wrap or ellipsize, never clip or overflow horizontally.
2. **Keyboard over forms inside sheets/overlays** — the focused field and the sheet's primary action stay visible with the keyboard up.
3. **Very long names** (username 40 chars, collection/item/listing titles 100 chars) — cards, rows and headers keep layout; full text reachable (details screen or accessibility label).
4. **Android back with a sheet, picker, link bar or editor open** — back closes the topmost layer first, never leaves the screen with unsaved edits silently.
5. **Backend unreachable / timeout** — every screen shows the translated `errors:network` / `errors:timeout` text with a retry where a list failed, never raw "Network Error".

Each line has a check step in the owning task (Tasks 3, 5, 9–15 for 1–3; Task 5 for 4; Task 8 for 5).

---

## File Structure

```
src/theme/theme.ts                         tokens (colors roles, spacing, type, borders, shadow, sizes, fonts)
src/theme/pressable.ts                     pressableShadowStyle(pressed, disabled) helper
src/i18n/index.ts                          i18next init, language detection, exports i18n
src/i18n/i18next.d.ts                      CustomTypeOptions (typed keys)
src/i18n/locales/en/*.json                 13 namespaces (common, navigation, auth, feed, collections, items,
                                           market, comments, settings, validation, errors, notifications, accessibility)
src/i18n/backend_messages.ts               GENERATED: backend English message → errors:backend.* key (+ patterns)
src/utils/api_error.ts                     mapApiError() pure + apiErrorText() (i18n)  — replaces apiErrorMessage
src/utils/keyboard_toolbar.ts              computeToolbarBottom() pure
src/hooks/keyboard_toolbar.ts              useKeyboardToolbarOffset(hostRef)
src/components/custom_ui/*                 rewritten shared components (+ new: card.tsx, list_row.tsx, states.tsx,
                                           screen.tsx, confirm_dialog.tsx, country_field.tsx, chip.tsx, tag.tsx)
src/components/market/ui/retro.tsx         re-exports moved primitives (keeps imports working)
scripts/check-i18n.mjs                     missing-key + hardcoded-string checker
scripts/gen-backend-messages.mjs           generates backend_messages.ts + errors.json backend section
tests/*.test.ts|mjs                        node:test suites
```

---

### Task 1: Tokens, font fix, i18n dependencies

**Files:**
- Modify: `src/theme/theme.ts`, `src/hooks/startup.tsx`, `package.json` (via npm), every file containing `fontFamily: "VendSans"` (7 occurrences)
- Create: `src/theme/pressable.ts`

**Interfaces — Produces:**
- `customTheme` (unchanged shape, kept), plus named exports:
  `colors = { ...customTheme.colors, bg:"#fefdf0", surface:"#fefdf0", surfaceAlt:"#f4f3e6", text:"#19283f", textMuted:"#696969", onPrimary:"#fefdf0", onSecondary:"#19283f", border:"#19283f", borderMuted:"rgba(25,40,63,0.25)", danger:"#b3261e", success:"#2e7d32", overlay:"rgba(0,0,0,0.5)" }`
- `spacing = { xxs:4, xs:8, sm:12, md:16, lg:24, xl:32, xxl:48 }`
- `fonts = { regular:"VendSansRegular", semibold:"VendSansSemiBold", bold:"VendSansBold", italic:"VendSansItalic" }`
- `typography: Record<"caption"|"meta"|"label"|"body"|"bodyStrong"|"title"|"headline"|"display", TextStyle>` with
  fontSize/lineHeight 12/16, 14/20, 14/20 bold, 16/24, 16/24 bold, 18/24 bold, 22/28 bold, 28/34 bold.
- `borders = { width:2, hairline:1, focus:3 }`, `shadow = { offset:3, pressable:"3px 3px 0px #19283f" }`,
  `sizes = { control:48, controlSm:40, touch:48, iconSm:20, iconMd:24, iconLg:32 }`
- `pressableShadowStyle(pressed: boolean, disabled?: boolean): ViewStyle` — `{boxShadow, transform}` per Global Constraints.

- [ ] **Step 1:** `npm install i18next react-i18next` — Expected: both in `dependencies`, `npm ls i18next react-i18next` clean.
- [ ] **Step 2:** Add tokens + `pressable.ts`; replace every `"VendSans"` literal with `fonts.regular`.
- [ ] **Step 3:** Verify: `grep -rn '"VendSans"' src` → no output; `npx tsc --noEmit` → exactly the 5 pre-existing errors (user.tsx, collection_delete_form.tsx ×3, item_register_form.tsx).
- [ ] **Step 4:** Run app on emulator (`npx expo start --dev-client`, press `a`), screenshot home: body text renders in VendSans.
  (Commit together with Task 2.)

### Task 2: i18n infrastructure + checker

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/i18next.d.ts`, `src/i18n/locales/en/{common,navigation,auth,feed,collections,items,market,comments,settings,validation,errors,notifications,accessibility}.json`, `scripts/check-i18n.mjs`, `tests/check-i18n.test.mjs`, `tests/fixtures/i18n/*`
- Modify: `src/app/_layout.tsx` (first line `import "../i18n";`), `package.json` scripts

**Interfaces — Produces:**
- `src/i18n/index.ts`: default export `i18n` (initialised synchronously, `initImmediate:false`, `resources` = all en
  JSON, `ns` = 13 namespaces, `defaultNS:"common"`, `fallbackLng:"en"`, `lng` = first of
  `RNLocalize.getLocales()[].languageCode` present in resources else `"en"`, `interpolation.escapeValue:false`,
  `returnNull:false`, `saveMissing: __DEV__` with `missingKeyHandler` → `console.warn`).
- `scripts/check-i18n.mjs [paths…]` — exit 0 when clean, 1 otherwise, printing `file:line  message`. Checks:
  (a) every `t("ns:key")` / `i18n.t("ns:key")` / `i18nKey="ns:key"` literal resolves in `locales/en/<ns>.json`
  (plural keys resolve when `key_one`/`key_other` exist); (b) hardcoded user-facing text in `.tsx`: JSX text nodes
  containing a letter, string literals in props `title|label|placeholder|text1|text2|accessibilityLabel|accessibilityHint|overlayTitle|modalTitle|message|multipleText|emptyText|header`,
  first/second string arg of `showToast(`, `Alert.alert(`. Ignores lines with `// i18n-ignore` and files listed in
  `scripts/i18n-allowlist.txt`.
- `package.json` scripts: `"check:i18n": "node scripts/check-i18n.mjs src"`, `"test:unit": "node --test tests/"`.

- [ ] **Step 1: Write failing tests** `tests/check-i18n.test.mjs`:
  - `reports missing key`: fixture `t("common:nope")` → exit 1, output contains `common:nope`.
  - `accepts existing and plural keys`: `t("common:actions.save")`, `t("common:itemCount", {count})` with `itemCount_one/_other` → exit 0.
  - `flags JSX text`: `<CustomText>Hello</CustomText>` → exit 1; `<CustomText>{t("common:x")}</CustomText>` → 0.
  - `flags literal props`: `placeholder="Search"` → 1; `placeholder={t("common:search")}` → 0.
  - `flags showToast literal`: `showToast("error", "Failed")` → 1.
  - `honours i18n-ignore`: `<Text>•</Text> // i18n-ignore` → 0; punctuation-only JSX text (`·`, `—`, `/`) is never flagged.
- [ ] **Step 2:** `node --test tests/` → FAIL (script missing).
- [ ] **Step 3:** Implement checker + i18n init + `common.json` seed (`actions.*`: save, cancel, close, delete, edit, retry, apply, reset, done, back, next, confirm, search, readMore, select, none; `states.*`: loading, empty, error).
- [ ] **Step 4:** `node --test tests/` → PASS. `npm run check:i18n` → FAIL listing current hardcoded strings (baseline count recorded in commit message).
- [ ] **Step 5:** App boots on emulator with `import "../i18n"`; no red box.
- [ ] **Step 6: Commit** `feat(ui): design tokens, VendSans font fix, i18n setup and string checker`

### Task 3: Core primitives

**Files:**
- Rewrite: `src/components/custom_ui/custom_text.tsx`, `custom_button.tsx`, `custom_icon_button.tsx`, `loading.tsx`, `toast.tsx`, `root_view.tsx`
- Create: `src/components/custom_ui/chip.tsx`, `tag.tsx`, `card.tsx`, `list_row.tsx`, `states.tsx`, `screen.tsx`, `toast_config.tsx`
- Modify: `src/components/market/ui/retro.tsx` (re-export moved primitives; keep WarningBanner, StarRating, ListingImageView there, restyled), `src/app/_layout.tsx` (`<Toast config={toastConfig} />`)

**Interfaces — Produces** (all props optional unless noted; every interactive one uses `Pressable` + `pressableShadowStyle`, `accessibilityRole`, `accessibilityState`):
- `CustomText` — existing props + `variant?: keyof typeof typography` (default `"body"`), `muted?: boolean`; foldable "read more" label from `common:actions.readMore`.
- `CustomButton` — `title: string` (req), `onPress`, `variant?: "primary"|"secondary"|"outline"|"danger"|"ghost"` (default `"primary"`), `size?: "md"|"sm"`, `loading`, `disabled`, `icon?: ReactNode`, `containerStyle`, `style`, `buttonStyle`, `titleStyle`, `accessibilityLabel`. Title `numberOfLines={2}`, centered. Keeps `alignSelf:"stretch"` default.
- `CustomIconButton` — existing props kept (`iconName`, `iconType` mapped to @expo/vector-icons family names already used: `"material"|"materialcommunityicons"|"fontawesome"|"entypo"|"ionicon"|…`), + `accessibilityLabel` (defaults to `title`), `variant?: "filled"|"plain"`; 48×48 hit area.
- `Chip({label, selected, onPress, disabled, icon, style})` — same API as retro Chip.
- `Tag({label, color, textColor})` — same API as retro Tag.
- `SectionCard({title, right, children, style, accent})` (in `card.tsx`) — flat, no shadow; `Card` alias.
- `ListRow({title, subtitle, meta, leading, trailing, onPress, onLongPress, accessibilityLabel, style})` — minHeight 56, title 2 lines, chevron when `onPress` and no `trailing`.
- `EmptyState({icon, title, text, action?: {label, onPress}})`, `ErrorState({message, onRetry})`, `SkeletonBlock({width, height})` in `states.tsx`.
- `Screen({children, scroll?, edges?, padded?, style})` — SafeAreaView(react-native-safe-area-context) with `edges` default `["bottom"]`, gutter `spacing.md`.
- `rootViewStyle()` — kept for callers; returns `{flex:1, padding:spacing.md, backgroundColor:colors.bg}` (inset-shadow frame removed).
- `LoadingScreen`, `Loading`, `ComponentLoading` — same exports; `Loading` label from `common:states.loading`.
- `showToast(type, title, description?)` unchanged signature; `toastConfig` renders square bordered toast with icon per type, danger/success left bar 6px.

- [ ] **Step 1:** Implement; keep every existing export name so no call site breaks.
- [ ] **Step 2:** `npx tsc --noEmit` → only the 5 baseline errors. `npx expo lint` → no new errors.
- [ ] **Step 3:** Emulator: home, collections, market, settings render with no crash; buttons show shadow, sink on press, disabled has no shadow.
- [ ] **Step 4 (Review Focus 1):** `adb shell wm size 720x1280 && adb shell wm density 360` (320dp) + `adb shell settings put system font_scale 1.3`; screenshot settings + market: no clipped button text. Reset: `adb shell wm size reset; adb shell wm density reset; adb shell settings put system font_scale 1.0`.
  (Commit with Task 5.)

### Task 4: Form controls

**Files:** Rewrite `custom_ui/custom_text_input.tsx`, `custom_dropdown.tsx`, `custom_dropdown_multiple.tsx`, `custom_autocomplete.tsx`

**Interfaces — Produces:**
- `CustomTextInput` = `forwardRef<TextInput, CustomTextInputProps>`; `CustomTextInputProps extends TextInputProps` + `label?`, `errorMessage?`, `helperText?`, `disabled?`, `readOnly?`, `leftIcon?: ReactNode`, `rightIcon?: ReactNode`, `variant?: "default"|"search"`, `onClear?: () => void` (search variant shows clear IconButton when value non-empty), `containerStyle?`, `inputContainerStyle?`, `inputStyle?`. `editable={false}` without `readOnly` renders like `readOnly` (existing callers use `editable` 9×). Focus → 3px gold border; error → danger border + text (`accessibilityLiveRegion="polite"`); multiline: `minHeight 96`, `maxHeight 200`, `textAlignVertical:"top"`. Placeholder color `colors.textMuted`.
- Dropdowns keep their current props; "None" item label `common:actions.none`, default placeholder/modal title `common:actions.select`; modal uses `CustomOverlay`-style header (title + close IconButton), list rows `ListRow`-like 56dp with ✓ replaced by `MaterialIcons check`, `errorMessage` in danger.
- `CustomAutocomplete` — same props; empty-list helper text `common:autocomplete.customValueHint`.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** tsc baseline only; lint clean.
- [ ] **Step 3:** Emulator: register form (dev logout → register) + item edit: focus, error, disabled, read-only, multiline growth, dropdown modal open/select/clear, autocomplete custom value; keyboard `next` moves focus where `returnKeyType` set.
  (Commit with Task 5.)

### Task 5: Overlays, dialogs, header, tab bar, FAB

**Files:**
- Rewrite: `custom_ui/custom_overlay.tsx`, `custom_ui/custom_overlay_message.tsx`, `components/layout/index_custom_layout.tsx`, `index_collection_custom_layout.tsx`, `settings_layout.tsx`, `components/collections/tabs/layout/collection_tabs_custom_layout.tsx`, `animated_tab_icon.tsx`, `components/itemregister/item_register_action_button*.tsx`
- Create: `custom_ui/confirm_dialog.tsx`
- Modify: `src/app/tabs/_layout.tsx` (tab titles via `navigation:tabs.*`)

**Interfaces — Produces:**
- `CustomOverlay({isVisible, onClose, overlayTitle, children, footerContent})` — RN `Modal` (`animationType="slide"`, `onRequestClose={onClose}`, `statusBarTranslucent`, `navigationBarTranslucent`), full-screen cream sheet, header 56dp (title `headline` 1 line + close IconButton `accessibility:close`), body `flex:1` inside `KeyboardAvoidingView` (`behavior` = `"padding"` iOS / `undefined` Android), footer bar with 2px top border and bottom safe-area padding (no radius).
- `CustomOverlayMessage({isVisible, onClose, overlayTitle, message})` — centered square dialog, 2px border, OK button.
- `ConfirmDialog({isVisible, title, message, confirmLabel, cancelLabel?, destructive?, loading?, onConfirm, onCancel})`.
- Header: gold bar, back IconButton **left** (`accessibility:back`), title + optional screenTitle under it; `title` default `navigation:header.hello` with `{{name}}`.
- Tab bar: cream, 2px navy top border, height 64 + bottom inset, active = 4px gold bar on top of item + bold label.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** tsc baseline; lint clean.
- [ ] **Step 3 (Review Focus 2):** Open listing form overlay and comment overlay, focus the last field with keyboard up → field and footer action visible (screenshot).
- [ ] **Step 4 (Review Focus 4):** With an overlay open press Android back (`adb shell input keyevent 4`) → overlay closes, screen stays.
- [ ] **Step 5:** All 4 tabs + FAB navigate as before; deep screens show left back arrow that works.
- [ ] **Step 6: Commit** `feat(ui): redesigned shared components, forms, overlays and navigation chrome`

### Task 6: Rich text editor + toolbar on the keyboard

**Files:**
- Create: `src/utils/keyboard_toolbar.ts`, `src/hooks/keyboard_toolbar.ts`, `tests/keyboard_toolbar.test.ts`
- Rewrite: `custom_ui/custom_rich_text_editor.tsx`, `custom_ui/custom_html_view.tsx`
- Modify: callers `collection_info_edit_form.tsx`, `settings/user_info_card.tsx` (remove `keyboadVerticalOffset` props)

**Interfaces — Produces:**
- `computeToolbarBottom(input: { hostBottom: number; keyboardTop: number | null; minBottom?: number }): number | null` — `null` when `keyboardTop === null`; else `Math.max(minBottom ?? 0, hostBottom - keyboardTop)`.
- `useKeyboardToolbarOffset(hostRef: RefObject<View>): number | null` — listens `keyboardWillShow/WillHide/WillChangeFrame` on iOS, `keyboardDidShow/DidHide` on Android; on show reads `e.endCoordinates.screenY`, calls `hostRef.current.measureInWindow` → `hostBottom = y + height`, returns `computeToolbarBottom`.
- `CustomRichTextEditor({initialContent, onChangeValue, placeholder, label?, minHeight?=160, richTextHeight?, margin?})` — toolbar rendered `position:"absolute", left:0, right:0, bottom: offset` inside the host view only when offset ≠ null; tentap `theme.toolbar` per spec (toolbarBody cream, borderTop 2 navy, height 48; toolbarButton cream, paddingHorizontal 4; iconWrapper radius 0 + 40×40 centered; iconWrapperActive gold; iconDisabled tintColor navy @30%; icon tintColor navy 24×24; linkBarTheme radius 0, input VendSans 16 navy, doneButton navy with cream text), `placeholder` default `common:richText.placeholder`, content CSS 16px/1.5, padding 12, VendSans fallback stack. `CustomHTMLView` typography identical (16/24), "read more" from i18n.

- [ ] **Step 1: Write failing test** `tests/keyboard_toolbar.test.ts`:
  - hidden: `{hostBottom:800,keyboardTop:null}` → `null`
  - overlap: `{hostBottom:800,keyboardTop:500}` → `300`
  - keyboard below host: `{hostBottom:400,keyboardTop:500}` → `0`
  - minBottom: `{hostBottom:400,keyboardTop:500,minBottom:8}` → `8`
- [ ] **Step 2:** `node --test tests/keyboard_toolbar.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement util, hook, editor, html view.
- [ ] **Step 4:** test → PASS; tsc baseline; lint clean.
- [ ] **Step 5: Device check** — for each of: Pixel 7 default, `wm size 720x1280 density 320`, `wm size 1080x2520 density 420` (tall 21:9), `wm size 1440x3120 density 560`: open Settings → user bio and Collection → edit description, focus editor, screenshot. Pass = toolbar's bottom border touches keyboard top (0–2px), toolbar fully visible, not over the keyboard; heading + link sub-bars also aligned; caret line stays visible while typing 15 lines.
- [ ] **Step 6: Commit** `feat(editor): Coffer-styled rich text editor with keyboard-anchored toolbar`

### Task 7: CountryField

**Files:** Create `custom_ui/country_field.tsx`; Modify `components/login/registerform.tsx`, `components/settings/user_info_card.tsx`, `components/market/browse/listing_filter_overlay.tsx`; add `common:country.*` keys.

**Interfaces — Produces:**
- `CountryField({label?, value?: CountryCode | null, onSelect(country: Country): void, errorMessage?, disabled?, withCallingCode?, placeholder?, renderTrigger?: (open: () => void) => ReactNode, visible?, onClose?})` — trigger styled as TextField (flag + name, 2 lines, chevron); `renderTrigger` lets the market filter keep its "+ Other country" Chip; `visible/onClose` for controlled use.
- Picker config: `theme={{ primaryColor: colors.text, primaryColorVariant: colors.secondary, backgroundColor: colors.bg, onBackgroundTextColor: colors.text, fontSize: 16, fontFamily: fonts.regular, filterPlaceholderTextColor: colors.textMuted, activeOpacity: 0.6, itemHeight: 56, flagSize: 24, flagSizeButton: 24 }}`, `withFilter`, `withFlag`, `withEmoji`, `preferredCountries={value ? [value] : undefined}`, `renderCountryFilter` → search `CustomTextInput` (`common:country.searchPlaceholder`), custom close button image/style (48dp), `flatListProps={{ keyboardShouldPersistTaps:"handled", keyboardDismissMode:"on-drag", ItemSeparatorComponent: hairline }}`, `translation="common"`.

- [ ] **Step 1:** Implement + migrate the 3 callers (same selected values flow into the same state/setters).
- [ ] **Step 2:** tsc baseline; lint clean.
- [ ] **Step 3: Device check** at 320dp and default: register, settings, market filter → open, type "united" with keyboard up (list visible above keyboard), pick "United States Minor Outlying Islands" (long name wraps in trigger), reopen → selected country first. Market filter still adds/removes extra countries.
- [ ] **Step 4: Commit** `feat(ui): Coffer-styled CountryField for register, settings and market filter`

### Task 8: Backend error mapping

**Files:** Create `scripts/gen-backend-messages.mjs`, `src/i18n/backend_messages.ts` (generated), `src/utils/api_error.ts`, `tests/api_error.test.ts`; Modify `src/utils/market_api.ts` (`apiErrorMessage` delegates to `apiErrorText`), `src/i18n/locales/en/errors.json`.

**Interfaces — Produces:**
- `gen-backend-messages.mjs` scans `src/Coffer/Coffer.BusinessLogic` + `Coffer.ASPNET` `*.cs` for string literals passed to `Validation|Forbidden|NotFound|Conflict|Unavailable|Unauthorized|BadRequest|StatusCode(...)` (incl. `$"…{expr}…"` → pattern with `{{p0}}`, `{{p1}}`), writes `backend_messages.ts` exporting `BACKEND_MESSAGES: { text?: string; pattern?: string; key: string }[]` (key = `errors:backend.<camelCaseSlug>`) and merges `backend.<slug>` English strings into `errors.json` without touching other keys. Idempotent.
- `mapApiError(error: unknown, table = BACKEND_MESSAGES): { key: string; params?: Record<string, string> }` — order: no `response` & `code === "ECONNABORTED"` → `errors:timeout`; no `response` → `errors:network`; `data.code` in `{account_suspended → errors:accountSuspended, terms_required → errors:termsRequired, not_admin → errors:notAdmin, admin_provisioning_required → errors:adminProvisioningRequired}`; `data.message` exact/pattern match → table key (+params); else status: 400 `errors:badRequest`, 401 `errors:unauthorized`, 403 `errors:forbidden`, 404 `errors:notFound`, 409 `errors:conflict`, 413 `errors:tooLarge`, 429 `errors:tooManyRequests`, ≥500 `errors:server`; else `errors:unknown`.
- `apiErrorText(error: unknown, fallbackKey = "errors:unknown"): string` — `i18n.t(key, params)`. `api_error.ts` keeps pure `mapApiError` free of RN imports (i18n imported lazily by `apiErrorText` in a separate export file `api_error_text.ts` if needed for node tests).

- [ ] **Step 1: Write failing tests** `tests/api_error.test.ts`: network (`{isAxiosError:true}` no response) → `errors:network`; timeout (`code:"ECONNABORTED"`) → `errors:timeout`; `{response:{status:409,data:{code:"terms_required"}}}` → `errors:termsRequired`; exact message `"Only active listings can be archived."` with a test table → its key; pattern `"Listing {{p0}} not found"` vs `"Listing 42 not found"` → key + `{p0:"42"}`; unknown message 409 → `errors:conflict`; 503 → `errors:server`; non-axios `new Error()` → `errors:unknown`.
- [ ] **Step 2:** `node --test tests/api_error.test.ts` → FAIL.
- [ ] **Step 3:** Implement; run generator; replace every user-facing use of raw backend text (`apiErrorMessage`, `error.message`, `response.data` strings in toasts) with `apiErrorText` (grep `apiErrorMessage\|\.message` in `src/components src/app src/hooks`).
- [ ] **Step 4:** tests PASS; tsc baseline; `node scripts/gen-backend-messages.mjs` twice → `git diff --stat` unchanged on second run.
- [ ] **Step 5 (Review Focus 5):** stop the API container (`docker compose -f docker-compose.dev.yml stop api`), pull-to-refresh feed/market/chats → translated network text + Retry; restart → Retry recovers.
- [ ] **Step 6: Commit** `feat(i18n): map backend errors to translated frontend messages`

---

## Area passes (Tasks 9–15)

Every area task has the same shape. **Steps:**

- [ ] **Step 1 (failing check):** `node scripts/check-i18n.mjs <area paths>` → FAIL, lists the area's hardcoded strings.
- [ ] **Step 2:** Redesign each listed file per spec "Screen-by-screen direction" + the task's specifics, using only shared components/tokens (no raw hex, no `borderRadius`, no ad-hoc shadows — `grep -nE "#[0-9a-fA-F]{3,6}|borderRadius|boxShadow" <area paths>` must only show tokens/helpers); move all static text into the task's namespace(s); label maps in `src/const/*` used by the area become `Record<Enum, string>` of i18n keys resolved with `t()` at render.
- [ ] **Step 3:** `node scripts/check-i18n.mjs <area paths>` → PASS; tsc → no errors in area files (baseline errors in area fixed); lint clean.
- [ ] **Step 4 (device):** Walk every workflow listed for the area on the emulator at Pixel 7 default and at 320dp + font_scale 1.3 (Review Focus 1); one long-name sample per list (Review Focus 3); keyboard up on every form (Review Focus 2). Fix what's found, re-run.
- [ ] **Step 5: Commit** `feat(ui): redesign <area> + i18n`

### Task 9: Auth & account
Paths: `src/app/index.tsx`, `src/app/login.tsx`, `src/components/login/*`, `src/components/account/suspended_screen.tsx`, `src/hooks/auth.ts`. Namespace `auth`, `validation`.
Workflows: Google/GitHub buttons, dev login list + sign-in, register (username availability spinner/error, country, submit), suspended screen "Check again", logout from settings returns to login. Register form uses `CountryField` (Task 7) and focus chaining.

### Task 10: Home feed & search
Paths: `src/app/tabs/index.tsx`, `src/components/collections/tabs/home/*`, `src/app/tabs/myfollows.tsx`. Namespaces `feed`, `navigation`.
Layout: feed cards image-first (image aspect kept), owner row, actions row (like/rarity/comments) 48dp; rarity selector as Chips; search overlay with scope chips + `ListRow` results; follows list as `ListRow`s. Workflows: scroll/paginate feed, like/unlike, rarity vote, open comments, search items/collections/users and open each, follow/unfollow, open other user.

### Task 11: Collections
Paths: `src/app/tabs/collections.tsx`, `src/app/mycollection/*`, `src/components/collections/collections_container.tsx`, `create_collection_form.tsx`, `src/components/collections/tabs/mycollection/**`, `src/components/collections/tabs/layout/*`. Namespace `collections`.
Fix baseline tsc errors in `collection_delete_form.tsx` (null-guard `collection`; route `ROUTES.TABS.COLLECTIONS`). Layout: collection grid cards (2 cols ≥360dp); info card with description in `CustomHTMLView`; filter bottom sheet sectioned with sticky Apply/Reset footer; item list keeps existing layout modes + pagination. Workflows: create (name availability), edit (name, type fields, description editor), delete with `ConfirmDialog`, filter by tag/boolean/date/dropdown/dynamic, sort, switch layout mode, paginate, open item.

### Task 12: Items
Paths: `src/app/itemdetails/*`, `src/app/otheruseritemdetails/*`, `src/components/itemdetails/*`, `src/components/itemregister/*`, `custom_ui/custom_image*.tsx`, `custom_ui/custom_pagination.tsx`. Namespace `items`.
Fix baseline tsc error in `item_register_form.tsx` (pass `onErrorChange`). Layout: details as labeled attribute rows; edit form grouped with sticky save bar; register overlay flow (image picker sheet: camera/gallery 64dp tiles; collection select as ListRows). Workflows: register item with camera + gallery image, similarity check result, pick collection, set dynamic fields (text, number, date/month, boolean, dropdown, multi-dropdown, autocomplete, tags, quantity), save; edit; delete with confirm; full-screen image zoom; report other user's item.

### Task 13: Market
Paths: `src/app/tabs/market.tsx`, `src/app/listingdetails/*`, `src/app/chat/*`, `src/components/market/**`, `src/const/market.ts` (labels → keys; `MARKET_TERMS` → `market:terms.sections.*`). Namespace `market`.
Layout: listing cards 2-col grid ≥360dp / 1-col below; filter overlay sectioned with sticky Apply/Reset; listing details image carousel + price block + seller ListRow + WarningBanner; chats as ListRows with unread badge; bubbles square bordered, own = navy fill/cream text, other = cream/navy border; deal panel as status card with step list; PIN entry large cells; reviews as rows with StarRating. Workflows: browse/filter/sort/city radius/country, listing details, create/edit/archive/reactivate listing with images, terms gate accept, open chat, send message/price offer/meetup proposal, propose/accept/cancel deal, PIN handoff (QR scan with camera + manual), shipping add tracking/mark received/report problem, review (low-rating comment rule), report listing/message/review, my listings/deals tabs.

### Task 14: Comments
Paths: `src/components/comments/*`. Namespace `comments`.
Layout: threaded rows, indentation step 16dp capped at depth 2 (deeper replies show "replying to @name"), composer docked above keyboard. Workflows: open from item/feed, add, reply, mention, edit, delete (confirm), removed-by-moderator display, report comment, open linked item.

### Task 15: Settings, profile, other user, reports, developer
Paths: `src/app/settings/*`, `src/components/settings/**`, `src/app/otheruser/*`, `src/app/otherusercollection/*`, `src/components/otheruser/*`, `src/components/otherusercollection/*`, `src/components/layout/settings_layout.tsx`. Namespaces `settings`, `notifications`.
Fix baseline tsc error in `src/app/settings/user.tsx` (pass the missing `AddContactOverlay` props from its real state — check how `user_contact_card.tsx` opens it and keep one source of truth). Layout: settings index as grouped `ListRow`s with logout separated in danger; user info card read-only vs edit; bio editor (Task 6); contacts as ListRows + add/edit contact overlay; reports screen tabs (My reports / Moderation of my content) as rows with Tags; other user profile header + collection grid. Workflows: edit name/country/bio, add/edit/delete contacts per platform, view reports + open linked listing/chat, mark moderation seen, developer screen actions, logout; other user: follow, open collection, open item.

### Task 16: Full verification & final sweep

- [ ] **Step 1:** `npm run check:i18n` (whole `src`) → PASS; `node --test tests/` → PASS; `npx tsc --noEmit` → 0 errors; `npx expo lint` → 0 errors.
- [ ] **Step 2:** `grep -rnE "borderRadius|\"red\"|'red'|fontFamily: \"VendSans\"" src` → only intentional (none expected); `grep -rn "react-native-elements" src` → list remaining uses, migrate any visual leftovers.
- [ ] **Step 3:** Full walkthrough of every area's workflow list on Pixel 7 + 320dp/1.3 + tall 21:9 + 480dp-wide; rich text + country picker matrix re-run; fix all findings (commit `fix(ui): issues from full device pass` if any).
- [ ] **Step 4:** Write the final report (spec §12 headings) in the closing message; reset emulator `wm size/density/font_scale`.
