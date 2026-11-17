/**
 * Maps a failed API call to a frontend translation key, so users see Coffer's own (translatable) messages instead
 * of raw backend English. The backend sends a stable `code` (+ `params`) next to its English `message`; the app
 * translates the code (errors:backend.<code>) and never matches the message text, so rewording it on the backend
 * can't break a translation. Pure (no React Native / i18n imports) so it can be unit tested with node.
 */

export interface MappedError {
  key: string;
  params?: Record<string, string>;
}

/** Machine-readable codes the app reacts to with their own (non-backend-section) keys. */
const SPECIAL_CODE_KEYS: Record<string, string> = {
  account_suspended: "errors:accountSuspended",
  terms_required: "errors:termsRequired",
  not_admin: "errors:notAdmin",
  admin_provisioning_required: "errors:adminProvisioningRequired",
};

function statusKey(status: number): string {
  if (status === 400) return "errors:badRequest";
  if (status === 401) return "errors:unauthorized";
  if (status === 403) return "errors:forbidden";
  if (status === 404) return "errors:notFound";
  if (status === 409) return "errors:conflict";
  if (status === 413) return "errors:tooLarge";
  if (status === 429) return "errors:tooManyRequests";
  if (status >= 500) return "errors:server";
  return "errors:unknown";
}

function stringParams(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = v == null ? "" : String(v);
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * @param knownCodes codes that have a text in the `errors:backend` section (an unknown code — e.g. from a newer
 * backend — falls back to the HTTP status).
 */
export function mapApiError(error: unknown, knownCodes: ReadonlySet<string>): MappedError {
  const e = error as { isAxiosError?: boolean; code?: string; response?: { status: number; data?: unknown } } | null | undefined;
  if (!e || !e.isAxiosError) return { key: "errors:unknown" };
  if (!e.response) return { key: e.code === "ECONNABORTED" ? "errors:timeout" : "errors:network" };

  const data = e.response.data as { code?: unknown; params?: unknown } | string | undefined;
  const code = typeof data === "object" && data && typeof data.code === "string" ? data.code : undefined;
  if (code && SPECIAL_CODE_KEYS[code]) return { key: SPECIAL_CODE_KEYS[code] };
  if (code && knownCodes.has(code)) {
    const params = stringParams(typeof data === "object" && data ? data.params : undefined);
    return params ? { key: `errors:backend.${code}`, params } : { key: `errors:backend.${code}` };
  }
  return { key: statusKey(e.response.status) };
}
