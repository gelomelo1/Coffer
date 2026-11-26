/** Pure helpers of the Shape What's Next page (no React Native imports, so node tests can run them). */

/** How far the phone's clock is behind the server (ms): add it to Date.now() to get server time. */
export function clockOffset(serverNow: string, deviceNow: number): number {
  return Date.parse(serverNow) - deviceNow;
}

export type Remaining = { days: number; hours: number; minutes: number; seconds: number; totalMs: number };

/** Time left until endsAt in server time, split for the countdown; never negative. */
export function remaining(endsAt: string, offset: number, now: number): Remaining {
  const totalMs = Math.max(0, Date.parse(endsAt) - (now + offset));
  // Rounded up: the clock reads 00:00:00 only once the end has really come.
  const total = Math.ceil(totalMs / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    totalMs,
  };
}

/** Share of the phase already gone (0–1), for the progress bar. */
export function elapsedShare(openedAt: string, endsAt: string, offset: number, now: number): number {
  const start = Date.parse(openedAt);
  const end = Date.parse(endsAt);
  const at = now + offset;
  if (end <= start) return at >= end ? 1 : 0;
  return Math.min(1, Math.max(0, (at - start) / (end - start)));
}

/** A classification form: under the minimum, ready to send, or full. */
export function formState(count: number, min = 5, max = 10): "tooFew" | "ready" | "full" {
  if (count < min) return "tooFew";
  return count >= max ? "full" : "ready";
}

/** A vote share as a whole percentage in the app language ("41%", "41 %"). */
export function shareLabel(share: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(share);
  } catch {
    return `${Math.round(share * 100)}%`;
  }
}

/** Two digits for the clock part of the countdown. */
export const pad2 = (n: number) => String(n).padStart(2, "0");
