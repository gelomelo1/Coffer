/**
 * Decides which connection page a failed backend request should open. Two different problems, two pages:
 *   "offline" — the phone has no internet (Wi-Fi/mobile data off or not working);
 *   "server"  — the phone is online but Coffer's server doesn't answer (down, restarting, unreachable).
 * Anything the server did answer (400, 404, 500…) is an ordinary error the screen shows itself. Pure (no React
 * Native imports) so it can be unit tested with node.
 */
export type ConnectionProblem = "offline" | "server";

/** The parts of a NetInfo state this needs. null = not known yet. */
export interface DeviceNetwork {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}

/** Offline only when the phone says so; "don't know yet" counts as online so a page never opens on a guess. */
export function isDeviceOffline(state: DeviceNetwork): boolean {
  return state.isConnected === false || state.isInternetReachable === false;
}

const PROXY_SERVER_DOWN = new Set([502, 503, 504]);
const TIMEOUT_CODES = new Set(["ECONNABORTED", "ETIMEDOUT"]);

export function classifyFailure(error: unknown, deviceOffline: boolean): ConnectionProblem | null {
  const e = error as { isAxiosError?: boolean; code?: string; response?: { status: number } } | null | undefined;
  if (!e || !e.isAxiosError || e.code === "ERR_CANCELED") return null;
  if (e.response) return PROXY_SERVER_DOWN.has(e.response.status) ? "server" : null;
  if (deviceOffline) return "offline";
  // Online but too slow (e.g. a large photo on a weak connection): the screen's own timeout message fits better.
  if (e.code && TIMEOUT_CODES.has(e.code)) return null;
  return "server";
}
