import { TextStyle } from "react-native";

/** Coffer's identity colors. Unchanged by the redesign — every other token builds on these. */
export const customTheme = {
  colors: {
    background: "#fefdf0",
    primary: "#19283f",
    secondary: "#a98d3c",
    disabledOverlay: "rgba(0,0,0,0.5)",
    accent: "dimgray",
  },
  colorChangePercent: {
    dark: -0.6,
    light: 0.8,
  },
};

/**
 * Semantic color roles. Contrast on cream: navy 14.5:1, dimgray 5.4:1, danger 6.4:1, success 5.0:1.
 * Gold on cream (3.1:1) is for icons, borders and large bold text only — never body text.
 */
export const colors = {
  ...customTheme.colors,
  bg: "#fefdf0",
  surface: "#fefdf0",
  surfaceAlt: "#f4f3e6",
  text: "#19283f", // i18n-ignore (color token, not copy)
  textMuted: "#696969",
  onPrimary: "#fefdf0",
  onSecondary: "#19283f",
  border: "#19283f",
  borderMuted: "rgba(25,40,63,0.25)",
  danger: "#b3261e",
  success: "#2e7d32",
  overlay: "rgba(0,0,0,0.5)",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Font family names as registered in hooks/startup.tsx. */
export const fonts = {
  regular: "VendSansRegular",
  semibold: "VendSansSemiBold",
  bold: "VendSansBold",
  italic: "VendSansItalic",
} as const;

export type TypographyVariant =
  | "caption"
  | "meta"
  | "label"
  | "body"
  | "bodyStrong"
  | "title"
  | "headline"
  | "display";

export const typography: Record<TypographyVariant, TextStyle> = {
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  meta: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24 },
  title: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  headline: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
};

export const borders = {
  width: 2,
  hairline: 1,
  focus: 3,
} as const;

/** Hard offset shadow — only on pressable elements (buttons, chips, FAB, tappable tiles). */
export const shadow = {
  offset: 3,
  pressable: `3px 3px 0px ${customTheme.colors.primary}`,
} as const;

export const sizes = {
  control: 48,
  controlSm: 40,
  touch: 48,
  iconSm: 20,
  iconMd: 24,
  iconLg: 32,
} as const;

/** Expands a small visual to the 48dp minimum touch target. */
export function hitSlopFor(visualSize: number) {
  const pad = Math.max(0, Math.ceil((sizes.touch - visualSize) / 2));
  return { top: pad, bottom: pad, left: pad, right: pad };
}
