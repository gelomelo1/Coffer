import { colors, spacing, typography } from "@/src/theme/theme";
import { ContributionState } from "@/src/types/entities/contribution";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { LatestResultCard } from "./latest_result_card";

/** No round is running: why (the admin's reason), and the outcome of the last vote. */
export function OffPanel({ state }: { state: ContributionState }) {
  const { t } = useTranslation();
  const reason = state.reason ?? "communityTooSmall";
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.md }}>
        <MaterialCommunityIcons name="rocket-launch-outline" size={56} color={colors.secondary} />
        <Text style={[typography.headline, { color: colors.text, textAlign: "center" }]} accessibilityRole="header">
          {t("community:shape.off.title")}
        </Text>
        <Text style={[typography.body, { color: colors.text, textAlign: "center" }]}>{t(`community:shape.off.reasons.${reason}`)}</Text>
      </View>
      {state.latestResult ? <LatestResultCard result={state.latestResult} /> : null}
    </View>
  );
}
