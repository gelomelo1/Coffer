import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { SectionHeader } from "@/src/components/custom_ui/card";
import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { dealStatusColors, dealStatusLabels, deliveryLabels } from "@/src/const/market";
import { useMyDeals } from "@/src/hooks/market_api";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { Deal, DealStatus } from "@/src/types/entities/market";
import { apiErrorText } from "@/src/utils/api_error_text";
import { formatPrice, formatTimeAgo } from "@/src/utils/market_api";
import { useTranslation } from "react-i18next";
import { Pressable, RefreshControl, SectionList, Text, View } from "react-native";
import { openChat } from "../chats/open_chat";
import { EmptyState, ListingImageView, Tag } from "../ui/retro";

const FINISHED: DealStatus[] = ["completed", "cancelled", "disputed"];
const needsMe = (d: Deal) => d.nextActions.some((a) => a !== "cancel");
/** Gold status tags need navy text; the darker ones take cream. */
const statusTextColor = (status: DealStatus) => (dealStatusColors[status] === colors.secondary ? colors.onSecondary : colors.onPrimary);

/** DEALS tab: grouped by what needs my attention. Tapping opens the chat with the deal panel. */
function DealList() {
  const { t } = useTranslation();
  const { items: data, isLoading, isError, error, refetch, refreshing, onRefresh, loadMore, isFetchingNextPage } = useMyDeals();

  const sections = [
    { title: t("market:deals.needsAction"), data: data.filter(needsMe) },
    { title: t("market:deals.inProgress"), data: data.filter((d) => !needsMe(d) && !FINISHED.includes(d.status)) },
    { title: t("market:deals.finished"), data: data.filter((d) => !needsMe(d) && FINISHED.includes(d.status)) },
  ].filter((s) => s.data.length > 0);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(d) => d.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={<ListFooterLoading loading={isFetchingNextPage} />}
      ListEmptyComponent={
        isLoading ? (
          <Loading />
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : (
          <EmptyState icon="handshake" title={t("market:deals.emptyTitle")} text={t("market:deals.emptyText")} />
        )
      }
      renderSectionHeader={({ section }) => <SectionHeader title={section.title} style={{ marginTop: spacing.xs }} />}
      renderItem={({ item }) => {
        const other = item.myRole === "buyer" ? item.seller : item.buyer;
        const meta = [
          item.myRole === "buyer" ? t("market:deals.buyingFrom", { name: other.name }) : t("market:deals.sellingTo", { name: other.name }),
          deliveryLabels[item.method],
          item.agreedPriceCents ? formatPrice(item.agreedPriceCents) : null,
          formatTimeAgo(item.updatedAt),
        ]
          .filter(Boolean)
          .join(" · "); // i18n-ignore
        const wantsReview = item.nextActions.includes("review");
        return (
          <Pressable
            onPress={() => openChat(item.conversationId, other.name, item.listingTitle)}
            accessibilityRole="button"
            accessibilityLabel={[item.listingTitle, dealStatusLabels[item.status], meta, wantsReview ? t("market:deals.review") : null]
              .filter(Boolean)
              .join(", ")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "center",
                borderWidth: borders.width,
                borderColor: colors.border,
                borderLeftWidth: 8,
                borderLeftColor: dealStatusColors[item.status],
                backgroundColor: colors.surface,
                padding: spacing.sm,
                marginBottom: spacing.md,
              },
              pressableShadowStyle(pressed),
            ]}
          >
            <ListingImageView fileName={item.listingImage} style={{ width: 56, height: 56 }} />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
                {item.listingTitle}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xxs }}>
                <Tag label={dealStatusLabels[item.status]} color={dealStatusColors[item.status]} textColor={statusTextColor(item.status)} />
                {wantsReview ? <Tag label={t("market:deals.review")} color={colors.secondary} textColor={colors.onSecondary} /> : null}
              </View>
              <Text style={[typography.caption, { color: colors.text }]}>{meta}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

export default DealList;
