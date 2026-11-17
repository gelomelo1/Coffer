import AsyncStorage from "@react-native-async-storage/async-storage";
import { asyncstoragekeys } from "../const/async_storage_keys";
import i18n, { detectLanguage, SUPPORTED_LANGUAGES } from "./index";
import { LanguagePreference, parsePreference } from "./language_preference";
import { AppLanguage } from "./resources";

export type AppLanguagePreference = LanguagePreference<AppLanguage>;

/** Languages offered in Settings › Language, each in its own language (never translated). */
export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: "English",
  hu: "Magyar",
};

/** The saved choice ("system" when nothing valid is saved). */
export async function loadLanguagePreference(): Promise<AppLanguagePreference> {
  try {
    return parsePreference(await AsyncStorage.getItem(asyncstoragekeys.language), SUPPORTED_LANGUAGES);
  } catch {
    return "system";
  }
}

/** Switches the app to the preference's language (no saving). */
export async function applyLanguagePreference(preference: AppLanguagePreference) {
  const language = preference === "system" ? detectLanguage() : preference;
  if (i18n.language !== language) await i18n.changeLanguage(language);
}

/** Saves the choice and switches the app language right away. */
export async function setLanguagePreference(preference: AppLanguagePreference) {
  await AsyncStorage.setItem(asyncstoragekeys.language, preference);
  await applyLanguagePreference(preference);
}
