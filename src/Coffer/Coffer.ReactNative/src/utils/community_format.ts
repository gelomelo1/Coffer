/** Pure helpers of the Stats & facts page (no React Native imports, so node tests can run them). */

/** 999 stays "999"; larger numbers become "1.2K", "2.5M" in the app language. */
export function compactNumber(n: number, locale: string): string {
  if (Math.abs(n) < 1000) return String(n);
  try {
    return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    const units: [number, string][] = [
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "K"],
    ];
    const [size, unit] = units.find(([s]) => Math.abs(n) >= s)!;
    return `${Math.round((n / size) * 10) / 10}${unit}`;
  }
}

const round = (v: number) => Math.round(v * 100) / 100;

/**
 * SVG paths of a small line chart: values spread over the width (padding on every side), the highest touching the
 * top padding, the lowest the bottom one. Equal values draw a flat line through the middle.
 */
export function chartPath(values: number[], width: number, height: number, pad: number) {
  if (values.length === 0) return { line: "", area: "", points: [] as { x: number; y: number }[] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const innerW = width - 2 * pad;
  const innerH = height - 2 * pad;
  const points = values.map((v, i) => ({
    x: round(values.length === 1 ? width / 2 : pad + (i * innerW) / (values.length - 1)),
    y: round(range === 0 ? height / 2 : pad + (1 - (v - min) / range) * innerH),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const bottom = round(height - pad);
  const area = `${line} L${points[points.length - 1].x},${bottom} L${points[0].x},${bottom} Z`;
  return { line, area, points };
}

/** The ladder's dots around the current rung (at most `max` of them, shifted at either end). */
export function ladderDots(rung: number, rungs: number, max = 7): ("past" | "current" | "future")[] {
  const size = Math.min(max, rungs);
  const start = Math.min(Math.max(rung - Math.floor(size / 2), 0), rungs - size);
  return Array.from({ length: size }, (_, i) => {
    const index = start + i;
    return index < rung ? "past" : index === rung ? "current" : "future";
  });
}

/** How full a progress bar is, 0..1 (a target of 0 shows empty). */
export function progressRatio(progress: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, progress / target));
}
