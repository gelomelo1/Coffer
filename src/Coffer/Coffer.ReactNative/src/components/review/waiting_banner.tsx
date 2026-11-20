import { usePendingSummary } from "@/src/hooks/pending";
import { openReview } from "@/src/hooks/review_store";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { daysUntil } from "@/src/utils/review_progress";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

/** "8 items waiting for review · Review" above a collection's items, only while something is waiting. */
function WaitingBanner({ collection }: { collection: Collection }) {
  const { t } = useTranslation();
  const { data: summary = [] } = usePendingSummary();
  const entry = summary.find((s) => s.collectionId === collection.id);
  const count = entry?.count ?? 0;
  if (!entry || count === 0) return null;
  const warning =
    entry.expiringSoon > 0
      ? t("collections:waiting.expiring", { count: entry.expiringSoon, when: t("collections:waiting.inDays", { count: daysUntil(entry.nextExpiresAt) }) })
      : null;

  return (
    <Pressable
      onPress={() => openReview({ collectionId: collection.id, collectionName: collection.name, collectionTypeId: collection.collectionTypeId })}
      accessibilityRole="button"
      accessibilityLabel={[t("collections:waiting.banner", { count }), warning, t("collections:waiting.review")].filter(Boolean).join(", ")}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          margin: spacing.md,
          marginBottom: 0,
          padding: spacing.md,
          minHeight: 56,
          backgroundColor: colors.surface,
          borderWidth: borders.width,
          borderColor: colors.border,
          borderLeftWidth: 6,
          borderLeftColor: warning ? colors.danger : colors.secondary,
        },
        pressableShadowStyle(pressed),
      ]}
    >
      <MaterialIcons name="inbox" size={sizes.iconMd} color={colors.text} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("collections:waiting.banner", { count })}</Text>
        {warning ? (
          <Text style={[typography.meta, { color: colors.danger }]}>{warning}</Text>
        ) : (
          <Text style={[typography.meta, { color: colors.textMuted }]}>{t("collections:waiting.bannerHint")}</Text>
        )}
      </View>
      <Text style={[typography.label, { color: colors.text }]}>{t("collections:waiting.review")}</Text>
      <MaterialIcons name="chevron-right" size={sizes.iconMd} color={colors.text} />
    </Pressable>
  );
}

export default WaitingBanner;
