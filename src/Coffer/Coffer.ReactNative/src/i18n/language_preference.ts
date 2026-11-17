/**
 * The user's language choice: an explicit app language, or "system" (follow the device). Pure, so it can be unit
 * tested with node; storage and i18next live in language.ts.
 */
export type LanguagePreference<L extends string = string> = "system" | L;

/** A stored value, validated: anything unknown (or nothing) means "follow the device". */
export function parsePreference<L extends string>(stored: string | null | undefined, supported: readonly L[]): LanguagePreference<L> {
  return stored && (supported as readonly string[]).includes(stored) ? (stored as L) : "system";
}

/** The language to show: the explicit choice, else the first supported device language, else English. */
export function resolveLanguage<L extends string>(preference: LanguagePreference<L>, deviceLocales: readonly string[], supported: readonly L[]): L {
  if (preference !== "system") return preference;
  for (const locale of deviceLocales) {
    const code = locale.split(/[-_]/)[0].toLowerCase();
    if ((supported as readonly string[]).includes(code)) return code as L;
  }
  return (supported.includes("en" as L) ? "en" : supported[0]) as L;
}
