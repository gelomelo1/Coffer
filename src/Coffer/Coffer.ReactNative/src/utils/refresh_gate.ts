/**
 * Single-flight token refresh: when many requests get 401 at once, they all wait for ONE refresh call (a second
 * refresh with the same token would be treated by the server as token theft and end the session). A failed refresh
 * calls onFail once (sign out) and rejects every waiter; the next call after it settled starts a fresh attempt.
 */
export function createRefreshGate(refresh: () => Promise<string>, onFail?: () => void): () => Promise<string> {
  let inFlight: Promise<string> | null = null;
  return () => {
    if (!inFlight) {
      inFlight = refresh()
        .catch((error: unknown) => {
          onFail?.();
          throw error;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  };
}
