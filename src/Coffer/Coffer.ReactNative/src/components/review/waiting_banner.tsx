import { usePendingSummary } from "@/src/hooks/pending";
import { openReview } from "@/src/hooks/review_store";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

/** "8 caps waiting for review · Review" above a collection's items, only while something is waiting. */
function WaitingBanner({ collection }: { collection: Collection }) {
  const { t } = useTranslation();
  const { data: summary = [] } = usePendingSummary();
  const count = summary.find((s) => s.collectionId === collection.id)?.count ?? 0;
  if (count === 0) return null;

  return (
    <Pressable
      onPress={() => openReview({ collectionId: collection.id, collectionName: collection.name, collectionTypeId: collection.collectionTypeId })}
      accessibilityRole="button"
      accessibilityLabel={`${t("collections:waiting.banner", { count })}, ${t("collections:waiting.review")}`}
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
          borderLeftColor: colors.secondary,
        },
        pressableShadowStyle(pressed),
      ]}
    >
      <MaterialIcons name="inbox" size={sizes.iconMd} color={colors.text} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("collections:waiting.banner", { count })}</Text>
        <Text style={[typography.meta, { color: colors.textMuted }]}>{t("collections:waiting.bannerHint")}</Text>
      </View>
      <Text style={[typography.label, { color: colors.text }]}>{t("collections:waiting.review")}</Text>
      <MaterialIcons name="chevron-right" size={sizes.iconMd} color={colors.text} />
    </Pressable>
  );
}

export default WaitingBanner;
