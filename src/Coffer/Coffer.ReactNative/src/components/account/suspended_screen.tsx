import CustomButton from "@/src/components/custom_ui/custom_button";
import { ROUTES } from "@/src/const/navigation_params";
import { useResetNavigation } from "@/src/hooks/navigation";
import { useSuspensionStore } from "@/src/hooks/suspension_store";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { formatDateTime, marketApi } from "@/src/utils/market_api";
import { signOut as endSession } from "@/src/utils/session";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Covers the whole app while the account is suspended. The block itself is enforced by the backend (every request
 * answers 403 account_suspended); this screen only explains why and until when. The reason is written by an
 * administrator and shown as is.
 */
function SuspendedScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { suspension, setSuspension } = useSuspensionStore();
  const resetNavigate = useResetNavigation();
  const [checking, setChecking] = useState(false);

  if (!suspension) return null;

  const checkAgain = async () => {
    setChecking(true);
    try {
      setSuspension(await marketApi.accountSuspension());
    } catch {
      // still suspended or offline: keep the screen
    } finally {
      setChecking(false);
    }
  };

  const signOut = async () => {
    await endSession({ callServer: true });
    setSuspension(null);
    resetNavigate(ROUTES.ROOT);
  };

  return (
    <View style={{ position: "absolute", inset: 0, backgroundColor: colors.bg, zIndex: 1000 }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: spacing.lg,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          gap: spacing.lg,
        }}
      >
        <MaterialIcons name="block" size={64} color={colors.danger} style={{ alignSelf: "center" }} />
        <Text accessibilityRole="header" style={[typography.headline, { color: colors.text, textAlign: "center" }]}>
          {t("auth:suspended.title")}
        </Text>
        <View style={{ borderWidth: borders.width, borderColor: colors.border, borderLeftWidth: 6, borderLeftColor: colors.danger, padding: spacing.md, gap: spacing.xs }}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("auth:suspended.until", { date: formatDateTime(suspension.endsAt) })}</Text>
          <Text style={[typography.label, { color: colors.text }]}>{t("auth:suspended.reasonLabel")}</Text>
          <Text style={[typography.body, { color: colors.text }]}>{suspension.reason}</Text>
        </View>
        <Text style={[typography.meta, { color: colors.text, textAlign: "center" }]}>{t("auth:suspended.explanation")}</Text>
        <View style={{ gap: spacing.sm }}>
          <CustomButton title={t("auth:suspended.checkAgain")} loading={checking} onPress={checkAgain} />
          <CustomButton title={t("auth:suspended.signOut")} variant="outline" onPress={signOut} />
        </View>
      </ScrollView>
    </View>
  );
}

export default SuspendedScreen;
