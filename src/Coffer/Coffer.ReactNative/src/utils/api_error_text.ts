import i18n from "../i18n";
import { BACKEND_MESSAGES } from "../i18n/backend_messages";
import { mapApiError } from "./api_error";

/** Translated, user-facing text for a failed API call (see mapApiError). */
export function apiErrorText(error: unknown, fallbackKey = "errors:unknown"): string {
  const { key, params } = mapApiError(error, BACKEND_MESSAGES);
  return i18n.t(key === "errors:unknown" ? fallbackKey : key, params ?? {});
}

/** The i18n key + params for a failed API call, for callers that render it themselves. */
export function apiErrorKey(error: unknown) {
  return mapApiError(error, BACKEND_MESSAGES);
}
