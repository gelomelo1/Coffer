import FeedSearchCollectionCard from "@/src/components/collections/tabs/home/feed_search_collection_card";
import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import CollectionSearch from "@/src/types/entities/collection_search";
import { FlatList, View } from "react-native";

function MyFollows() {
  const { user } = useUserStore();

  const { data: followsData = [], isFetching } = useGetData<CollectionSearch>(
    `${endpoints.feedUserFollows}/${user!.id}`,
    querykeys.followsData,
  );

  return (
    <View style={[rootViewStyle(), { flex: 1, padding: 0 }]}>
      <FlatList
        data={isFetching ? [] : followsData}
        keyExtractor={(item) => item.collection.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 10 }}>
            <FeedSearchCollectionCard
              currentUser={user!}
              collectionSearch={item}
              closeOverlay={() => {}}
            />
          </View>
        )}
        ListHeaderComponent={
          <View
            style={{
              width: "100%",
              backgroundColor: customTheme.colors.background,
            }}
          >
            <CustomText
              style={{ fontSize: 18, marginBottom: 5, paddingHorizontal: 10 }}
            >{`You follow ${followsData.length} collections`}</CustomText>
          </View>
        }
        stickyHeaderIndices={[0]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          <CustomText
            style={{
              textAlign: "center",
              fontFamily: "VendSansItalic",
              marginTop: 20,
            }}
          >
            End of results
          </CustomText>
        }
        ListEmptyComponent={isFetching ? <Loading /> : null}
      />
    </View>
  );
}

export default MyFollows;
