import { colors } from "@/src/theme/theme";
import OtherUserCollectionSectionList from "@/src/components/otheruser/other_user_collection_sectionlist";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetData } from "@/src/hooks/data_hooks";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { Collection } from "@/src/types/entities/collection";
import { View } from "react-native";

function OtherUser() {
  const { user: currentUser } = useUserStore();
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
        ],
        filterTree: {
          conjunction: "OR",
          filters: [
            {
              filter: "==",
              field: "collectionTypeId",
              value: 1,
            },
            {
              filter: "==",
              field: "collectionTypeId",
              value: 2,
            },
          ],
        },
      },
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OtherUserCollectionSectionList
        currentUser={currentUser!}
        user={user!}
        collections={otherUserCollectionsData}
        allLoading={isFetching}
      />
    </View>
  );
}

export default OtherUser;
