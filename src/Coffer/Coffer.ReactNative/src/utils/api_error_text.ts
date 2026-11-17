import i18n from "../i18n";
import errorsEn from "../i18n/locales/en/errors.json";
import { mapApiError } from "./api_error";
import { formatMoney } from "./format";
import { resolveTextParams } from "./text_params";

/** Backend error codes the app has a text for (English is the reference locale). */
const KNOWN_CODES: ReadonlySet<string> = new Set(Object.keys(errorsEn.backend ?? {}));

/** Translated, user-facing text for a failed API call (see mapApiError). */
export function apiErrorText(error: unknown, fallbackKey = "errors:unknown"): string {
  const { key, params } = mapApiError(error, KNOWN_CODES);
  // Params may be translation keys ("@t:errors:fields.title") or amounts ("@eur:1250").
  const resolved = resolveTextParams(params, (k) => i18n.t(k), (cents) => formatMoney(cents, i18n.language));
  return i18n.t(key === "errors:unknown" ? fallbackKey : key, resolved ?? {});
}

/** The i18n key + params for a failed API call, for callers that render it themselves. */
export function apiErrorKey(error: unknown) {
  return mapApiError(error, KNOWN_CODES);
}
