import NewsCard from "@/src/components/community/news_card";
import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { EmptyState, ErrorState, SkeletonBlock } from "@/src/components/custom_ui/states";
import { useNews } from "@/src/hooks/news";
import { borders, colors, spacing } from "@/src/theme/theme";
import { apiErrorText } from "@/src/utils/api_error_text";
import { useTranslation } from "react-i18next";
import { FlatList, RefreshControl, View } from "react-native";

/** Placeholder cards while the first page loads (same shape as a card, so nothing jumps). */
function NewsSkeleton() {
  return (
    <View style={{ gap: spacing.md }}>
      {[0, 1].map((i) => (
        <View key={i} style={{ borderWidth: borders.width, borderColor: colors.borderMuted }}>
          <SkeletonBlock height={180} />
          <View style={{ padding: spacing.md, gap: spacing.xs }}>
            <SkeletonBlock width="80%" height={20} />
            <SkeletonBlock width="35%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** News: published posts, newest first, 20 at a time. */
function News() {
  const { t } = useTranslation();
  const { items, isLoading, isError, error, refetch, refreshing, onRefresh, loadMore, isFetchingNextPage } = useNews();

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={items}
      keyExtractor={(n) => n.id}
      renderItem={({ item }) => <NewsCard post={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={<ListFooterLoading loading={isFetchingNextPage} />}
      ListEmptyComponent={
        isLoading ? (
          <NewsSkeleton />
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : (
          <EmptyState icon="newspaper" title={t("community:news.emptyTitle")} text={t("community:news.emptyText")} />
        )
      }
    />
  );
}

export default News;
