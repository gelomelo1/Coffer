import FeedSearchCollectionCard from "@/src/components/collections/tabs/home/feed_search_collection_card";
import { Divider } from "@/src/components/custom_ui/card";
import { Loading } from "@/src/components/custom_ui/loading";
import { EmptyState, ErrorState } from "@/src/components/custom_ui/states";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { fetchPage, usePagedQuery } from "@/src/hooks/paged_query";
import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { prefetchForExpandedGroup } from "@/src/utils/paging";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import CollectionSearch from "@/src/types/entities/collection_search";
import { apiErrorText } from "@/src/utils/api_error_text";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, RefreshControl, SectionList, Text, View } from "react-native";

/** Followed collections grouped by collection type; each group expands to its collection rows. */
const followId = (follow: CollectionSearch) => follow.collection.id;

function MyFollows() {
  const { t } = useTranslation();
  const { collectionTypes } = useCollectionTypeStore();
  const { token, user } = useUserStore();

  // Follows come 20 at a time, ordered by collection type, with the count per type for the section headers.
  const {
    items: followsData,
    total,
    groupCounts,
    isLoading,
    isError,
    error,
    refresh: refetch,
    loadMore,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = usePagedQuery<CollectionSearch>([querykeys.followsData], (page) => fetchPage<CollectionSearch>(endpoints.feedUserFollows, undefined, page), followId);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const loaded: Record<number, CollectionSearch[]> = {};
  for (const follow of followsData) (loaded[follow.collection.collectionTypeId] ??= []).push(follow);

  // Pages fill the groups in type order, so the sections follow that order too.
  const sections = collectionTypes
    .filter((ct) => (groupCounts[String(ct.id)] ?? 0) > 0)
    .sort((a, b) => a.id - b.id)
    .map((ct) => ({
      id: ct.id,
      title: ct.name,
      icon: ct.icon,
      color: ct.color,
      totalCount: groupCounts[String(ct.id)] ?? 0,
      data: expandedSections.has(ct.id) ? (loaded[ct.id] ?? []) : [],
    }));

  // An opened section whose entries are further down the list keeps loading pages until it has something to show.
  const loadedCounts = Object.fromEntries(Object.entries(loaded).map(([id, list]) => [Number(id), list.length]));
  const needsMore = prefetchForExpandedGroup([...expandedSections], loadedCounts, groupCounts);
  useEffect(() => {
    if (needsMore && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [needsMore, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.collection.id}
        renderItem={({ item }) => <FeedSearchCollectionCard currentUser={user!} collectionSearch={item} closeOverlay={() => {}} />}
        ItemSeparatorComponent={Divider}
        renderSectionHeader={({ section }) => {
          const expanded = expandedSections.has(section.id);
          return (
            <Pressable
              onPress={() => toggleSection(section.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={expanded ? t("feed:follows.collapse", { name: section.title }) : t("feed:follows.expand", { name: section.title })}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                minHeight: 56,
                paddingHorizontal: spacing.md,
                backgroundColor: pressed ? colors.surfaceAlt : colors.bg,
                borderBottomWidth: borders.width,
                borderTopWidth: borders.width,
                borderColor: colors.border,
                marginTop: -borders.width,
              })}
            >
              <View style={{ width: 36, height: 36, backgroundColor: section.color, borderWidth: borders.width, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
                <Image source={{ uri: `${endpoints.icons}/${section.icon}`, headers: { Authorization: `Bearer ${token}` }, cache: "reload" }} style={{ width: 26, height: 26 }} />
              </View>
              <Text numberOfLines={2} style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>
                {section.title}
              </Text>
              <View style={{ minWidth: 32, paddingHorizontal: spacing.xs, paddingVertical: 2, backgroundColor: colors.primary, alignItems: "center" }}>
                <Text style={[typography.label, { color: colors.onPrimary }]}>{section.totalCount}</Text>
              </View>
              <MaterialIcons name={expanded ? "expand-less" : "expand-more"} size={sizes.iconMd} color={colors.text} />
            </Pressable>
          );
        }}
        ListHeaderComponent={
          total > 0 ? (
            <Text accessibilityRole="header" style={[typography.title, { color: colors.text, padding: spacing.md }]}>
              {t("feed:follows.title", { count: total })}
            </Text>
          ) : null
        }
        stickySectionHeadersEnabled
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} colors={[colors.primary]} tintColor={colors.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isFetchingNextPage || (hasNextPage && needsMore) ? (
            <ListFooterLoading loading />
          ) : followsData.length > 0 && !hasNextPage ? (
            <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center", padding: spacing.xl }]}>{t("feed:search.endOfResults")}</Text>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <Loading />
          ) : isError ? (
            <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
          ) : (
            <EmptyState icon="person-add-alt" title={t("feed:follows.empty")} text={t("feed:follows.emptyHint")} />
          )
        }
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
      />
    </View>
  );
}

export default MyFollows;
