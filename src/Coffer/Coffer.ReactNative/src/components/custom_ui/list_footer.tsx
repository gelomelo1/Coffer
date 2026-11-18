import { colors, spacing } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

/** Shown under a list while its next page loads. */
function ListFooterLoading({ loading }: { loading: boolean }) {
  const { t } = useTranslation();
  if (!loading) return null;
  return (
    <View style={{ paddingVertical: spacing.lg, alignItems: "center" }} accessibilityRole="progressbar" accessibilityLabel={t("common:states.loadingMore")}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export default ListFooterLoading;
