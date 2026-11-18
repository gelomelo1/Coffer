import { colors } from "@/src/theme/theme";
import OtherUserItemSectionList from "@/src/components/otherusercollection/other_user_item_sectionlist";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useCollectionItems } from "@/src/hooks/collection_items";
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

  // 20 items at a time with the chosen filters and sort; the key changes with them, so no manual refetch.
  const {
    items: otherUserItemsData,
    isLoading: isItemsLoading,
    paging,
  } = useCollectionItems(`${querykeys.otherUserItemsData}${collection!.id}`, collection!.id, queryOptions);

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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OtherUserItemSectionList
        currentUser={currentUser!}
        user={user!}
        collectionType={collectionType!}
        collection={collection!}
        items={otherUserItemsData}
        paging={paging}
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
