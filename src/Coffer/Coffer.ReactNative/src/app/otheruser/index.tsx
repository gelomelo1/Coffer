import { colors } from "@/src/theme/theme";
import OtherUserCollectionSectionList from "@/src/components/otheruser/other_user_collection_sectionlist";
import { querykeys } from "@/src/const/querykeys";
import { fetchGroupedCollections, usePagedQuery } from "@/src/hooks/paged_query";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { Collection } from "@/src/types/entities/collection";
import { View } from "react-native";

function OtherUser() {
  const { user: currentUser } = useUserStore();
  const { user } = useOtherUserStore();

  // Their collections, 20 at a time (ordered by collection type, newest first); more load near the bottom.
  const { items, total, isLoading, onRefresh, refreshing, loadMore, isFetchingNextPage } = usePagedQuery<Collection>(
    [querykeys.otherUserCollectionsData, user!.id],
    (page) => fetchGroupedCollections<Collection>(user!.id, {}, page),
    (collection) => collection.id,
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OtherUserCollectionSectionList
        currentUser={currentUser!}
        user={user!}
        collections={items}
        total={total}
        allLoading={isLoading}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={loadMore}
        loadingMore={isFetchingNextPage}
      />
    </View>
  );
}

export default OtherUser;
