import { SectionHeader } from "@/src/components/custom_ui/card";
import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { Loading } from "@/src/components/custom_ui/loading";
import { isNearEnd } from "@/src/utils/paging";
import { EmptyState } from "@/src/components/custom_ui/states";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { borders, colors, spacing } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import User from "@/src/types/entities/user";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, View } from "react-native";
import { useTileColumns } from "../collections/collections_container";
import UserInfoCard from "../settings/user_info_card";
import OtherUserCollectionCard from "./other_user_collection_card";

interface OtherUserCollectionSectionListProps {
  currentUser: User;
  user: User;
  collections: Collection[];
  allLoading: boolean;
  /** How many collections they have in total (more load as the user scrolls). */
  total?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  onEndReached?: () => void;
  loadingMore?: boolean;
}

/** Another user's profile (general info + reputation) followed by their collections as a tile grid. */
function OtherUserCollectionSectionList({ currentUser, user, collections, allLoading, total, onRefresh, refreshing = false, onEndReached, loadingMore = false }: OtherUserCollectionSectionListProps) {
  const { t } = useTranslation();
  const { collectionTypes } = useCollectionTypeStore();
  const columns = useTileColumns();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} /> : undefined}
      onScroll={onEndReached ? (e) => isNearEnd(e.nativeEvent, 600) && onEndReached() : undefined}
      scrollEventThrottle={200}
    >
      <View style={{ borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md }}>
        <UserInfoCard user={user} otherUser />
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader
          title={total ? t("settings:otherUser.collectionsCount", { name: user.name, count: total }) : t("settings:otherUser.collections", { name: user.name })}
        />
        {allLoading ? (
          <Loading />
        ) : collections.length === 0 ? (
          <EmptyState icon="inventory-2" title={t("settings:otherUser.noCollections")} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {collections.map((collection) => {
              const type = collectionTypes.find((ct) => ct.id === collection.collectionTypeId);
              return type ? (
                <OtherUserCollectionCard
                  key={collection.id}
                  currentUser={currentUser}
                  user={user}
                  collection={collection}
                  collectionType={type}
                  columns={columns}
                />
              ) : null;
            })}
          </View>
        )}
        <ListFooterLoading loading={loadingMore} />
      </View>
    </ScrollView>
  );
}

export default OtherUserCollectionSectionList;
