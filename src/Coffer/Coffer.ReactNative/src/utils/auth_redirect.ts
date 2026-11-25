/** What came back from the provider's page in the in-app browser. */
export type AuthRedirect =
  | { kind: "code"; code: string; state: string }
  | { kind: "cancelled" }
  | { kind: "error"; error: string };

function params(url: string): Record<string, string> {
  const withoutFragment = url.split("#")[0];
  const query = withoutFragment.includes("?") ? withoutFragment.slice(withoutFragment.indexOf("?") + 1) : "";
  const result: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const [key, value = ""] = pair.split("=");
    try {
      result[decodeURIComponent(key.replace(/\+/g, " "))] = decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      // A malformed escape: ignore that parameter.
    }
  }
  return result;
}

/** One query parameter of a URL (e.g. the state the backend put into the authorize URL). */
export function queryParam(url: string, name: string): string | undefined {
  return params(url)[name];
}

/**
 * Checks the browser's answer before anything goes to the backend: it must come back on our own redirect URI, carry
 * the state we sent (the backend checks it again), and have a code. Cancelling or denying is a normal "cancelled".
 */
export function parseAuthResult(result: { type: string; url?: string }, expectedState: string, redirectUri: string): AuthRedirect {
  if (result.type !== "success" || !result.url) return { kind: "cancelled" };

  const rest = result.url.slice(redirectUri.length);
  if (!result.url.startsWith(redirectUri) || !(rest === "" || rest.startsWith("?") || rest.startsWith("#") || rest.startsWith("/")))
    return { kind: "error", error: "redirect_mismatch" };

  const p = params(result.url);
  if (p.error) return p.error === "access_denied" ? { kind: "cancelled" } : { kind: "error", error: p.error };
  if (!p.state || p.state !== expectedState) return { kind: "error", error: "state_mismatch" };
  if (!p.code) return { kind: "error", error: "missing_code" };
  return { kind: "code", code: p.code, state: p.state };
}

/** Google comes back through the API: only the state (the API holds the verified result), or an error. */
export type RelayRedirect = { kind: "ready"; state: string } | { kind: "cancelled" } | { kind: "error"; error: string };

export function parseRelayResult(result: { type: string; url?: string }, expectedState: string, redirectUri: string): RelayRedirect {
  if (result.type !== "success" || !result.url) return { kind: "cancelled" };

  const rest = result.url.slice(redirectUri.length);
  if (!result.url.startsWith(redirectUri) || !(rest === "" || rest.startsWith("?") || rest.startsWith("#") || rest.startsWith("/")))
    return { kind: "error", error: "redirect_mismatch" };

  const p = params(result.url);
  if (p.error) return p.error === "access_denied" ? { kind: "cancelled" } : { kind: "error", error: p.error };
  if (!p.state || p.state !== expectedState) return { kind: "error", error: "state_mismatch" };
  return { kind: "ready", state: p.state };
}
