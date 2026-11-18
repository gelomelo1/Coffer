import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import { Loading } from "@/src/components/custom_ui/loading";
import { useReputation, useUserReviews } from "@/src/hooks/market_api";
import { colors, sizes, spacing, typography } from "@/src/theme/theme";
import { formatDecimal } from "@/src/utils/format";
import { formatResponseTime } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, View } from "react-native";
import { EmptyState, StarRating } from "../ui/retro";
import ReviewCard from "./review_card";

/** "★ 4.5 (12) · 8 deals · replies within 2 hours" — tap to open the reviews. */
function ReputationSummary({ userId, userName, isMe = false }: { userId: string; userName?: string; isMe?: boolean }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: reputation } = useReputation(userId);
  const { items: reviews, isLoading, loadMore, isFetchingNextPage } = useUserReviews(userId, open);

  const response = formatResponseTime(reputation?.typicalResponseMinutes);
  const rating =
    reputation?.average != null
      ? reputation.count
        ? t("market:reputation.ratingWithCount", { rating: formatDecimal(reputation.average, i18n.language, 1), count: reputation.count })
        : formatDecimal(reputation.average, i18n.language, 1)
      : t("market:reputation.noRatings");
  const stats = [
    t("market:reputation.deals", { count: reputation?.completedDeals ?? 0 }),
    reputation?.responseRate != null ? t("market:reputation.answers", { percent: Math.round(reputation.responseRate * 100) }) : null,
    response ? t("market:reputation.usually", { time: response }) : null,
  ]
    .filter(Boolean)
    .join(" · "); // i18n-ignore

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${rating}, ${stats}`}
        accessibilityHint={t("market:reputation.showReviews")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          minHeight: sizes.touch,
          backgroundColor: pressed ? colors.surfaceAlt : "transparent",
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" }}>
            <StarRating value={reputation?.average ?? 0} size={16} />
            <Text style={[typography.label, { color: colors.text }]}>{rating}</Text>
          </View>
          <Text style={[typography.caption, { color: colors.text }]}>{stats}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={sizes.iconMd} color={colors.text} />
      </Pressable>

      <CustomOverlay
        isVisible={open}
        onClose={() => setOpen(false)}
        overlayTitle={userName ? t("market:reputation.titleOf", { name: userName }) : t("market:reputation.title")}
      >
        {isLoading ? (
          <Loading />
        ) : (
          <FlatList
            data={reviews}
            keyExtractor={(r) => r.id}
            contentContainerStyle={{ padding: spacing.md }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={<ListFooterLoading loading={isFetchingNextPage} />}
            ListHeaderComponent={
              <Text style={[typography.meta, { color: colors.text, marginBottom: spacing.md }]}>{t("market:reputation.verifiedNote")}</Text>
            }
            ListEmptyComponent={<EmptyState icon="star-border" title={t("market:reputation.empty")} />}
            renderItem={({ item }) => <ReviewCard review={item} canRespond={isMe} />}
          />
        )}
      </CustomOverlay>
    </>
  );
}

export default ReputationSummary;
