import rootViewStyle from "@/src/components/custom_ui/root_view";
import OtherUserItemSectionList from "@/src/components/otherusercollection/other_user_item_sectionlist";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import Attribute from "@/src/types/entities/attribute";
import { ItemProvided } from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { useEffect, useState } from "react";
import { View } from "react-native";

function OtherUserCollection() {
  const { collectionType } = useCollectionStore();
  const { user: currentUser } = useUserStore();
  const { user, collection } = useOtherUserStore();

  const [queryOptions, setQueryOptions] = useState<QueryOptions>({});

  const {
    data: otherUserItemsData = [],
    isFetching: isItemsFetching,
    refetch,
  } = useGetData<ItemProvided>(
    endpoints.items,
    `${querykeys.otherUserItemsData}${collection!.id}`,
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
    }
  );

  const { data: attributes = [], isFetching: isAttributesFetching } =
    useGetData<Attribute>(
      endpoints.attributes,
      `${querykeys.attributesData}${collectionType.id}`,
      {
        filters: [
          {
            filter: "==",
            field: "collectionTypeId",
            value: collectionType.id,
          },
        ],
      }
    );

  const allLoading = isItemsFetching || isAttributesFetching;

  useEffect(() => {
    refetch();
  }, [queryOptions, refetch]);

  return (
    <View
      style={[
        rootViewStyle({ color: collectionType.color }),
        { flex: 1, padding: 0 },
      ]}
    >
      <OtherUserItemSectionList
        currentUser={currentUser!}
        user={user!}
        collectionType={collectionType}
        collection={collection!}
        items={otherUserItemsData}
        attributes={attributes}
        allLoading={allLoading}
        queryOptions={{
          value: queryOptions,
          set: setQueryOptions,
        }}
      />
    </View>
  );
}

export default OtherUserCollection;
