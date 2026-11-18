import CollectionSectionList from "@/src/components/collections/tabs/mycollection/collection_item_list/collection_sectionlist";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useCollectionItems } from "@/src/hooks/collection_items";
import { useGetData } from "@/src/hooks/data_hooks";
import Attribute from "@/src/types/entities/attribute";
import { ItemProvided } from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { useEffect, useState } from "react";
import { View } from "react-native";

function MyCollection() {
  const { collectionType, collection } = useCollectionStore();

  const [queryOptions, setQueryOptions] = useState<QueryOptions>({});

  // 20 items at a time with the chosen filters and sort; the key changes with them, so no manual refetch.
  const { items, isLoading: isItemsLoading, paging } = useCollectionItems(`${querykeys.itemsData}${collection!.id}`, collection!.id, queryOptions);

  const { data: attributes = [], isFetching: isAttributesFetching } =
    useGetData<Attribute>(
      endpoints.attributes,
      `${querykeys.attributesData}${collectionType!.id}`,
      {
        filters: [
          {
            filter: "==",
            field: "collectionTypeId",
            value: collectionType!.id,
          },
        ],
      },
    );

  const allLoading = isItemsLoading || isAttributesFetching;

  return (
    <View
      style={[
        rootViewStyle({ color: collectionType!.color }),
        { flex: 1, padding: 0 },
      ]}
    >
      <CollectionSectionList
        collectionType={collectionType!}
        collection={collection!}
        items={items}
        paging={paging}
        attributes={attributes}
        allLoading={allLoading}
        queryOptions={{ value: queryOptions, set: setQueryOptions }}
      />
    </View>
  );
}

export default MyCollection;
