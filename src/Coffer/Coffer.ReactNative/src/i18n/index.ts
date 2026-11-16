import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "react-native-localize";
import { AppLanguage, namespaces, resources } from "./resources";

export const FALLBACK_LANGUAGE: AppLanguage = "en";

/** First device language Coffer has translations for, otherwise English. */
export function detectLanguage(): AppLanguage {
  try {
    for (const locale of getLocales()) {
      if (locale.languageCode in resources) return locale.languageCode as AppLanguage;
    }
  } catch {
    // Native module unavailable (e.g. tests) — use the fallback.
  }
  return FALLBACK_LANGUAGE;
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: detectLanguage(),
    fallbackLng: FALLBACK_LANGUAGE,
    ns: namespaces,
    defaultNS: "common",
    nsSeparator: ":",
    keySeparator: ".",
    initAsync: false,
    returnNull: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    saveMissing: __DEV__,
    missingKeyHandler: (lngs, ns, key) => {
      console.warn(`[i18n] missing key ${ns}:${key} (${lngs.join(",")})`);
    },
  });
} else {
  // Fast Refresh re-runs this module after a locale JSON changes: refresh the loaded bundles in place.
  for (const [lng, bundles] of Object.entries(resources)) {
    for (const [ns, bundle] of Object.entries(bundles)) i18n.addResourceBundle(lng, ns, bundle, true, true);
  }
}

export default i18n;
