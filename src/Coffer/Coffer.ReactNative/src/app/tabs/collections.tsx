import CollectionsContainer, { CollectionSorts } from "@/src/components/collections/collections_container";
import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import CreateCollectionForm from "@/src/components/collections/create_collection_form";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { Loading } from "@/src/components/custom_ui/loading";
import { EmptyState, ErrorState } from "@/src/components/custom_ui/states";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { fetchGroupedCollections, usePagedQuery } from "@/src/hooks/paged_query";
import { isNearEnd } from "@/src/utils/paging";
import { useUserStore } from "@/src/hooks/user_store";
import { colors, spacing } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import { apiErrorText } from "@/src/utils/api_error_text";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView } from "react-native";

const collectionId = (collection: Collection) => collection.id;

function Collections() {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const { collectionTypes } = useCollectionTypeStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [sorts, setSorts] = useState<CollectionSorts>({});
  const toggleSort = (typeId: number) => setSorts((prev) => ({ ...prev, [typeId]: prev[typeId] === "name" ? "createdAt" : "name" }));

  // 20 at a time, ordered by collection type (each type sorted as chosen); more load near the bottom.
  const {
    items: collections,
    groupCounts,
    isLoading,
    isError,
    error,
    refresh: refetch,
    refreshing,
    onRefresh,
    loadMore,
    isFetchingNextPage,
  } = usePagedQuery<Collection>([querykeys.collectionsData, "grouped", user!.id, sorts], (page) => fetchGroupedCollections(user!.id, sorts, page), collectionId);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        onScroll={(e) => isNearEnd(e.nativeEvent, 600) && loadMore()}
        scrollEventThrottle={200}
      >
        <CustomButton
          title={t("collections:list.create")}
          icon={<MaterialIcons name="add" color={colors.onPrimary} size={24} />}
          onPress={() => setIsCreateOpen(true)}
        />
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : collections.length === 0 ? (
          <EmptyState icon="inventory-2" title={t("collections:list.emptyTitle")} text={t("collections:list.emptyText")} />
        ) : (
          <CollectionsContainer collectionTypes={collectionTypes} collections={collections} groupCounts={groupCounts} sorts={sorts} onToggleSort={toggleSort} />
        )}
        <ListFooterLoading loading={isFetchingNextPage} />
      </ScrollView>
      <CreateCollectionForm
        isCreateNewCollectionOverlayOpen={{ value: isCreateOpen, set: setIsCreateOpen }}
        collectionTypes={collectionTypes}
        user={user!}
      />
    </>
  );
}

export default Collections;
