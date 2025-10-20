import rootViewStyle from "@/src/components/custom_ui/root_view";
import OtherUserCollectionSectionList from "@/src/components/otheruser/other_user_collection_sectionlist";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { Collection } from "@/src/types/entities/collection";
import { View } from "react-native";

function OtherUser() {
  const { user: currentUser } = useUserStore();
  const { collectionType } = useCollectionStore();
  const { user } = useOtherUserStore();

  const { data: otherUserCollectionsData = [], isFetching } =
    useGetData<Collection>(
      endpoints.collections,
      querykeys.otherUserCollectionsData,
      {
        filters: [
          {
            filter: "Match",
            field: "userId",
            value: user!.id,
          },
          {
            filter: "==",
            field: "collectionTypeId",
            value: collectionType.id,
          },
        ],
      }
    );

  return (
    <View
      style={[
        rootViewStyle({ color: collectionType.color }),
        { flex: 1, padding: 0 },
      ]}
    >
      <OtherUserCollectionSectionList
        currentUser={currentUser!}
        user={user!}
        collectionType={collectionType}
        collections={otherUserCollectionsData}
        allLoading={isFetching}
      />
    </View>
  );
}

export default OtherUser;
