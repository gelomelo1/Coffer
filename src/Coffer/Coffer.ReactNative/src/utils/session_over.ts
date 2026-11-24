/**
 * Did a failed refresh mean the session is really over? Only when the server said so (401 invalidRefreshToken, or
 * 400 for a request it refused). No answer (offline, timeout), a server error or a rate limit says nothing about the
 * session: the tokens are kept and the next request tries again. No stored refresh token means the person is
 * already signed out, so there is nothing more to do.
 */
export function isSessionOver(error: unknown): boolean {
  const e = error as { isAxiosError?: boolean; response?: { status?: number } } | null;
  if (!e?.isAxiosError || !e.response) return false;
  return e.response.status === 401 || e.response.status === 400;
}

/**
 * The error a request reports when its refresh failed. Session over (or nothing stored): the request's own 401, which
 * sends the person to sign-in. A transient refresh failure: that failure itself (offline, timeout, server trouble),
 * so the screen offers a retry and the tokens stay.
 */
export function errorToReport(original: unknown, refreshError: unknown): unknown {
  const e = refreshError as { isAxiosError?: boolean } | null;
  return e?.isAxiosError && !isSessionOver(refreshError) ? refreshError : original;
}
