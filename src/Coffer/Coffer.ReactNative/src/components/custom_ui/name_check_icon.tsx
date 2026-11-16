import { colors, sizes } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { ActivityIndicator } from "react-native";

/** Trailing status for fields checked against the server (name availability): spinner, error or OK. */
export function NameCheckIcon({ checking, error, ok }: { checking: boolean; error: boolean; ok: boolean }) {
  const { t } = useTranslation();
  if (checking) return <ActivityIndicator size="small" color={colors.textMuted} accessibilityLabel={t("validation:checking")} />;
  if (error) return <MaterialIcons name="error-outline" size={sizes.iconMd} color={colors.danger} accessibilityLabel={t("validation:invalid")} />;
  if (ok) return <MaterialIcons name="check-circle-outline" size={sizes.iconMd} color={colors.success} accessibilityLabel={t("validation:available")} />;
  return null;
}

export default NameCheckIcon;
