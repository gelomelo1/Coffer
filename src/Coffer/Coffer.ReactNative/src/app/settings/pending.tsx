import { Loading } from "@/src/components/custom_ui/loading";
import { Screen } from "@/src/components/custom_ui/screen";
import { EmptyState, ErrorState } from "@/src/components/custom_ui/states";
import { usePendingSummary } from "@/src/hooks/pending";
import { openReview } from "@/src/hooks/review_store";
import { useUserStore } from "@/src/hooks/user_store";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { apiErrorText } from "@/src/utils/api_error_text";
import { pendingImageUrl } from "@/src/utils/pending_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, View } from "react-native";

/** Every collection with caps waiting for review; opens that collection's review. */
function PendingOverview() {
  const { t } = useTranslation();
  const { token } = useUserStore();
  const { data: summary = [], isLoading, isError, error, refetch } = usePendingSummary();

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  return (
    <Screen scroll>
      <Text style={[typography.body, { color: colors.text }]}>{t("settings:pending.intro")}</Text>
      {summary.length === 0 ? (
        <EmptyState icon="task-alt" title={t("settings:pending.emptyTitle")} text={t("settings:pending.emptyText")} />
      ) : (
        summary.map((s) => (
          <Pressable
            key={s.collectionId}
            onPress={() => openReview({ collectionId: s.collectionId, collectionName: s.collectionName, collectionTypeId: s.collectionTypeId })}
            accessibilityRole="button"
            accessibilityLabel={`${s.collectionName}, ${t("settings:pending.count", { count: s.count })}`}
            style={({ pressed }) => [
              { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface },
              pressableShadowStyle(pressed),
            ]}
          >
            <Image
              source={{ uri: pendingImageUrl(s.latestId), headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
              style={{ width: 64, height: 64, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
                {s.collectionName}
              </Text>
              <Text style={[typography.meta, { color: colors.textMuted }]}>{t("settings:pending.count", { count: s.count })}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={sizes.iconMd} color={colors.text} />
          </Pressable>
        ))
      )}
    </Screen>
  );
}

export default PendingOverview;
