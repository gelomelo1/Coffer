export function adjustColor(hex: string, percent: number): string {
  hex = hex.replace(/^#/, "");

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  if (percent < 0) {
    const value = 1 + percent;
    r = Math.max(0, Math.floor(r * value));
    g = Math.max(0, Math.floor(g * value));
    b = Math.max(0, Math.floor(b * value));
  } else {
    r = Math.min(255, Math.floor(r + (255 - r) * percent));
    g = Math.min(255, Math.floor(g + (255 - g) * percent));
    b = Math.min(255, Math.floor(b + (255 - b) * percent));
  }

  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function convertToGrayScaleColor(color: string) {
  if (!color.startsWith("#")) return "gray";
  const r = parseInt(color.substr(1, 2), 16);
  const g = parseInt(color.substr(3, 2), 16);
  const b = parseInt(color.substr(5, 2), 16);
  const avg = Math.round((r + g + b) / 3);
  const hex = avg.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}
