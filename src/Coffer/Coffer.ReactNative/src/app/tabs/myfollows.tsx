import FeedSearchCollectionCard from "@/src/components/collections/tabs/home/feed_search_collection_card";
import { Divider } from "@/src/components/custom_ui/card";
import { Loading } from "@/src/components/custom_ui/loading";
import { EmptyState, ErrorState } from "@/src/components/custom_ui/states";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import CollectionSearch from "@/src/types/entities/collection_search";
import { apiErrorText } from "@/src/utils/api_error_text";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, RefreshControl, SectionList, Text, View } from "react-native";

/** Followed collections grouped by collection type; each group expands to its collection rows. */
function MyFollows() {
  const { t } = useTranslation();
  const { collectionTypes } = useCollectionTypeStore();
  const { token, user } = useUserStore();

  const { data: followsData = [], isFetching, isError, error, refetch } = useGetData<CollectionSearch>(
    `${endpoints.feedUserFollows}`,
    querykeys.followsData,
  );

  const existingCollectionTypeIds = Array.from(new Set(followsData.map((follow) => follow.collection.collectionTypeId)));
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const sections = collectionTypes
    .filter((ct) => existingCollectionTypeIds.includes(ct.id))
    .map((ct) => {
      const items = followsData.filter((follow) => follow.collection.collectionTypeId === ct.id);
      return { id: ct.id, title: ct.name, icon: ct.icon, color: ct.color, totalCount: items.length, data: expandedSections.has(ct.id) ? items : [] };
    });

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
          followsData.length > 0 ? (
            <Text accessibilityRole="header" style={[typography.title, { color: colors.text, padding: spacing.md }]}>
              {t("feed:follows.title", { count: followsData.length })}
            </Text>
          ) : null
        }
        stickySectionHeadersEnabled
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} colors={[colors.primary]} tintColor={colors.primary} />}
        ListFooterComponent={
          followsData.length > 0 ? (
            <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center", padding: spacing.xl }]}>{t("feed:search.endOfResults")}</Text>
          ) : null
        }
        ListEmptyComponent={
          isFetching ? (
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
