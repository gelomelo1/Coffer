import { ListRow } from "@/src/components/custom_ui/list_row";
import { Screen } from "@/src/components/custom_ui/screen";
import showToast from "@/src/components/custom_ui/toast";
import { detectLanguage, SUPPORTED_LANGUAGES } from "@/src/i18n";
import { AppLanguagePreference, LANGUAGE_NAMES, loadLanguagePreference, setLanguagePreference } from "@/src/i18n/language";
import { borders, colors, sizes, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

/** Settings › Language: follow the device, or pick English / Magyar. Applies at once and is remembered. */
function Language() {
  const { t } = useTranslation();
  const [preference, setPreference] = useState<AppLanguagePreference | null>(null);

  useEffect(() => {
    loadLanguagePreference().then(setPreference);
  }, []);

  const choose = async (next: AppLanguagePreference) => {
    if (next === preference) return;
    setPreference(next);
    await setLanguagePreference(next);
    showToast("success", t("settings:language.changed"));
  };

  const options: { value: AppLanguagePreference; title: string; subtitle?: string }[] = [
    { value: "system", title: t("settings:language.device"), subtitle: t("settings:language.deviceHint", { language: LANGUAGE_NAMES[detectLanguage()] }) },
    ...SUPPORTED_LANGUAGES.map((code) => ({ value: code as AppLanguagePreference, title: LANGUAGE_NAMES[code] })),
  ];

  return (
    <Screen scroll>
      <Text style={[typography.body, { color: colors.text }]}>{t("settings:language.intro")}</Text>
      <View accessibilityRole="radiogroup" style={{ borderWidth: borders.width, borderColor: colors.border }}>
        {options.map((option, i) => {
          const selected = preference === option.value;
          return (
            <ListRow
              key={option.value}
              title={option.title}
              subtitle={option.subtitle}
              leading={
                <MaterialIcons
                  name={selected ? "radio-button-checked" : "radio-button-unchecked"}
                  size={sizes.iconMd}
                  color={colors.text}
                />
              }
              trailing={selected ? <MaterialIcons name="check" size={sizes.iconMd} color={colors.text} /> : <View />}
              onPress={() => choose(option.value)}
              accessibilityLabel={[option.title, option.subtitle].filter(Boolean).join(", ")}
              style={[
                i > 0 && { borderTopWidth: borders.hairline, borderColor: colors.borderMuted },
                selected && { backgroundColor: colors.surfaceAlt },
              ]}
            />
          );
        })}
      </View>
    </Screen>
  );
}

export default Language;
