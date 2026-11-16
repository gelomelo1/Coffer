/**
 * Maps a failed API call to a frontend translation key, so users see Coffer's own (translatable) messages instead
 * of raw backend English. Pure (no React Native / i18n imports) so it can be unit tested with node.
 */

/** A known backend message: exact `text`, or `pattern` with {{p0}}, {{p1}}… placeholders for interpolated parts. */
export interface BackendMessage {
  text?: string;
  pattern?: string;
  key: string;
}

export interface MappedError {
  key: string;
  params?: Record<string, string>;
}

const CODE_KEYS: Record<string, string> = {
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

const regexCache = new Map<string, { re: RegExp; names: string[] }>();

function compile(pattern: string) {
  let hit = regexCache.get(pattern);
  if (!hit) {
    const names: string[] = [];
    const source = pattern
      .split(/(\{\{\w+\}\})/)
      .map((part) => {
        const m = /^\{\{(\w+)\}\}$/.exec(part);
        if (m) {
          names.push(m[1]);
          return "(.+?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    hit = { re: new RegExp(`^${source}$`), names };
    regexCache.set(pattern, hit);
  }
  return hit;
}

export function matchBackendMessage(message: string, table: BackendMessage[]): MappedError | null {
  const trimmed = message.trim();
  for (const entry of table) {
    if (entry.text !== undefined && entry.text === trimmed) return { key: entry.key };
  }
  for (const entry of table) {
    if (!entry.pattern) continue;
    const { re, names } = compile(entry.pattern);
    const m = re.exec(trimmed);
    if (m) {
      const params: Record<string, string> = {};
      names.forEach((n, i) => (params[n] = m[i + 1]));
      return { key: entry.key, params };
    }
  }
  return null;
}

export function mapApiError(error: unknown, table: BackendMessage[]): MappedError {
  const e = error as { isAxiosError?: boolean; code?: string; response?: { status: number; data?: unknown } } | null | undefined;
  if (!e || !e.isAxiosError) return { key: "errors:unknown" };
  if (!e.response) return { key: e.code === "ECONNABORTED" ? "errors:timeout" : "errors:network" };

  const data = e.response.data as { code?: string; message?: string; title?: string } | string | undefined;
  const code = typeof data === "object" && data ? data.code : undefined;
  if (code && CODE_KEYS[code]) return { key: CODE_KEYS[code] };

  const message = typeof data === "string" ? data : typeof data === "object" && data ? (data.message ?? data.title) : undefined;
  if (message) {
    const hit = matchBackendMessage(message, table);
    if (hit) return hit;
  }
  return { key: statusKey(e.response.status) };
}
