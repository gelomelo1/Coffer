import CollectionSectionList from "@/src/components/collections/tabs/mycollection/collection_item_list/collection_sectionlist";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData } from "@/src/hooks/data_hooks";
import Attribute from "@/src/types/entities/attribute";
import { ItemProvided } from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { useEffect, useState } from "react";
import { View } from "react-native";

function MyCollection() {
  const { collectionType, collection } = useCollectionStore();

  const [queryOptions, setQueryOptions] = useState<QueryOptions>({});

  const {
    data: items = [],
    isFetching: isItemsFetching,
    refetch,
  } = useGetData<ItemProvided>(
    endpoints.items,
    `${querykeys.itemsData}${collection!.id}`,
    {
      filters: [
        {
          filter: "Match",
          field: "collectionId",
          value: collection!.id,
        },
        ...(queryOptions.filters ?? []),
      ],
      sort: queryOptions.sort,
      page: queryOptions.page,
      pageSize: queryOptions.pageSize,
      filterConjunction: queryOptions.filterConjunction,
      filterTree: queryOptions.filterTree,
    },
  );

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

  const allLoading = isItemsFetching || isAttributesFetching;

  useEffect(() => {
    refetch();
  }, [queryOptions, refetch]);

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
        attributes={attributes}
        allLoading={allLoading}
        queryOptions={{ value: queryOptions, set: setQueryOptions }}
      />
    </View>
  );
}

export default MyCollection;
