import CustomButton from "@/src/components/custom_ui/custom_button";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import Item from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useState } from "react";
import CollectionItemListNumbers from "./collection_item_list_numbers";
import CollectionListFilterBottomSheet from "./collection_list_filter_bottomsheet";

interface CollectionListItemFilterWrapperProps {
  items: Item[];
  attributes: Attribute[];
  queryOptions: {
    value: QueryOptions;
    set: React.Dispatch<React.SetStateAction<QueryOptions>>;
  };
}

function CollectionListItemFilterWrapper({
  items,
  attributes,
  queryOptions,
}: CollectionListItemFilterWrapperProps) {
  const [
    isCollectionListFilterBottomSheetOpen,
    setIsCollectionListFilterBottemSheetOpen,
  ] = useState(false);

  return (
    <>
      <CustomButton
        title="Filter"
        containerStyle={{
          position: "absolute",
          bottom: 10,
          left: 10,
          right: 10,
        }}
        titleStyle={{
          fontSize: 20,
        }}
        icon={
          <FontAwesome
            name="filter"
            size={24}
            color={customTheme.colors.secondary}
            style={{ marginRight: 5 }}
          />
        }
        onPress={() => setIsCollectionListFilterBottemSheetOpen(true)}
      />
      <CollectionItemListNumbers
        items={items}
        queryOptions={queryOptions.value}
      />
      <CollectionListFilterBottomSheet
        isCollectionListFilterBottomSheetOpen={{
          value: isCollectionListFilterBottomSheetOpen,
          set: setIsCollectionListFilterBottemSheetOpen,
        }}
        items={items}
        attributes={attributes}
        setQueryOptions={queryOptions.set}
      />
    </>
  );
}

export default CollectionListItemFilterWrapper;
