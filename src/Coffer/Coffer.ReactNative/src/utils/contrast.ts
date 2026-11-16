/** WCAG relative luminance of a #rgb / #rrggbb color; null when the string is not a hex color. */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21) between two hex colors; 1 when either cannot be parsed. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la == null || lb == null) return 1;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Picks whichever of the two text colors reads better on `background` (e.g. user-chosen collection type colors).
 * Named or otherwise unparseable backgrounds get `light`, since the app's named tag colors are dark.
 */
export function readableTextOn(background: string, dark: string, light: string): string {
  if (luminance(background) == null) return light;
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}
