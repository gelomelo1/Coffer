import CollectionInfoCard from "@/src/components/collections/tabs/mycollection/collection_info/collection_info_card";
import CollectionItemListCard from "@/src/components/collections/tabs/mycollection/collection_item_list/collection_item_list_card";
import CollectionListItemFilterWrapper from "@/src/components/collections/tabs/mycollection/collection_item_list/collection_item_list_filter_wrapper";
import CollectionItemList from "@/src/components/collections/tabs/mycollection/collection_item_list/collection_item_title";
import { Loading } from "@/src/components/custom_ui/loading";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData } from "@/src/hooks/data_hooks";
import Item from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";

function MyCollection() {
  const { collectionType, collection } = useCollectionStore();

  const [queryOptions, setQueryOptions] = useState<QueryOptions>({});

  const {
    data: items = [],
    isFetching,
    refetch,
  } = useGetData<Item>(
    endpoints.items,
    `${querykeys.itemsData}${collection.id}`,
    {
      filters: [
        {
          filter: "Match",
          field: "collectionId",
          value: collection.id,
        },
        ...(queryOptions.filters ?? []),
      ],
      sort: queryOptions.sort,
      page: queryOptions.page,
      pageSize: queryOptions.pageSize,
      filterConjunction: queryOptions.filterConjunction,
    }
  );

  useEffect(() => {
    console.log("yeah");
    console.log(queryOptions);
    refetch();
  }, [queryOptions, refetch]);

  return (
    <View
      style={[
        rootViewStyle({ color: collectionType.color }),
        { flex: 1, paddingVertical: 0 },
      ]}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={(item) => (
          <CollectionItemListCard item={item} collectionType={collectionType} />
        )}
        contentContainerStyle={{
          paddingTop: 20,
          paddingBottom: 80,
        }}
        ListHeaderComponent={
          <>
            <CollectionInfoCard />
            <CollectionItemList />
            {isFetching ? <Loading /> : null}
          </>
        }
        columnWrapperStyle={{ justifyContent: "center", gap: 10 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
      <CollectionListItemFilterWrapper
        items={items}
        queryOptions={{ value: queryOptions, set: setQueryOptions }}
      />
    </View>
  );
}

export default MyCollection;
