import CollectionsContainer from "@/src/components/collections/collections_container";
import CreateCollectionForm from "@/src/components/collections/create_collection_form";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { Loading } from "@/src/components/custom_ui/loading";
import { EmptyState, ErrorState } from "@/src/components/custom_ui/states";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { colors, spacing } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import { apiErrorText } from "@/src/utils/api_error_text";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView } from "react-native";

function Collections() {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const { collectionTypes } = useCollectionTypeStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const {
    data: collections = [],
    isFetching,
    isError,
    error,
    refetch,
  } = useGetData<Collection>(endpoints.collections, querykeys.collectionsData, {
    filters: [{ filter: "Match", field: "userId", value: user!.id }],
  });

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <CustomButton
          title={t("collections:list.create")}
          icon={<MaterialIcons name="add" color={colors.onPrimary} size={24} />}
          onPress={() => setIsCreateOpen(true)}
        />
        {isFetching && collections.length === 0 ? (
          <Loading />
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : collections.length === 0 ? (
          <EmptyState icon="inventory-2" title={t("collections:list.emptyTitle")} text={t("collections:list.emptyText")} />
        ) : (
          <CollectionsContainer collectionTypes={collectionTypes} collections={collections} />
        )}
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
