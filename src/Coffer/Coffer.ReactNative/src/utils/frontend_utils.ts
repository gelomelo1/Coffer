export function darkenBy60Percent(hex: string): string {
  // Remove leading #
  hex = hex.replace(/^#/, "");

  // Expand shorthand hex (#abc -> #aabbcc)
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  // Apply 60% black = scale down by 40%
  r = Math.max(0, Math.floor(r * 0.4));
  g = Math.max(0, Math.floor(g * 0.4));
  b = Math.max(0, Math.floor(b * 0.4));

  // Convert back to hex
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
