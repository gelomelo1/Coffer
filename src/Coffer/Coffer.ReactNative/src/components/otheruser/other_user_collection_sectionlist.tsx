import { SectionHeader } from "@/src/components/custom_ui/card";
import { Loading } from "@/src/components/custom_ui/loading";
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
  onRefresh?: () => void;
}

/** Another user's profile (general info, as before the redesign — contacts stay private to the settings) followed by their collections as a tile grid. */
function OtherUserCollectionSectionList({ currentUser, user, collections, allLoading, onRefresh }: OtherUserCollectionSectionListProps) {
  const { t } = useTranslation();
  const { collectionTypes } = useCollectionTypeStore();
  const columns = useTileColumns();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} /> : undefined}
    >
      <View style={{ borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md }}>
        <UserInfoCard user={user} otherUser />
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t("settings:otherUser.collections", { name: user.name })} />
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
      </View>
    </ScrollView>
  );
}

export default OtherUserCollectionSectionList;
