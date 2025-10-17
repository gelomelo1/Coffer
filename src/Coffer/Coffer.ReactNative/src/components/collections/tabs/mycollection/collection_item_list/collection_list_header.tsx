import CustomText from "@/src/components/custom_ui/custom_text";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { ItemProvided } from "@/src/types/entities/item";
import { QueryOptions } from "@/src/types/helpers/query_data";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import CollectionItemListNumbers from "./collection_item_list_numbers";
import CollectionListFilterBottomSheet from "./collection_list_filter_bottomsheet";

interface CollectionItemHeaderProps {
  items: ItemProvided[];
  attributes: Attribute[];
  queryOptions: {
    value: QueryOptions;
    set: React.Dispatch<React.SetStateAction<QueryOptions>>;
  };
  isStickyShadow: boolean;
}

function CollectionItemHeader({
  items,
  attributes,
  queryOptions,
  isStickyShadow,
}: CollectionItemHeaderProps) {
  const { collectionType } = useCollectionStore();

  const [
    isCollectionListFilterBottomSheetOpen,
    setIsCollectionListFilterBottemSheetOpen,
  ] = useState(false);

  return (
    <View
      style={{
        width: "100%",
        backgroundColor: customTheme.colors.background,
        paddingHorizontal: 10,
        paddingVertical: 10,
        boxShadow: isStickyShadow
          ? ` 0 4px 4px -4px ${customTheme.colors.disabledOverlay}`
          : "none",
      }}
    >
      <CollectionItemListNumbers
        items={items}
        queryOptions={queryOptions.value}
      />
      <View
        style={{
          width: "100%",
          justifyContent: "space-between",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <CustomText
          style={{
            fontSize: 20,
          }}
        >
          Your{" "}
          <View style={{ transform: [{ translateY: 5 }] }}>
            <CustomText
              style={{
                fontSize: 24,
                fontFamily: "VendSansBold",
                color: customTheme.colors.secondary,
              }}
            >
              {collectionType.name}
            </CustomText>
          </View>{" "}
          collection
        </CustomText>
        <TouchableOpacity
          style={{ justifyContent: "center", flexDirection: "row", gap: 10 }}
          onPress={() => setIsCollectionListFilterBottemSheetOpen(true)}
        >
          <CustomText style={{ fontSize: 20 }}>Filter</CustomText>
          <Ionicons
            name="filter"
            size={24}
            color={customTheme.colors.primary}
          />
        </TouchableOpacity>
      </View>
      <CollectionListFilterBottomSheet
        isCollectionListFilterBottomSheetOpen={{
          value: isCollectionListFilterBottomSheetOpen,
          set: setIsCollectionListFilterBottemSheetOpen,
        }}
        items={items}
        attributes={attributes}
        setQueryOptions={queryOptions.set}
      />
    </View>
  );
}

export default CollectionItemHeader;
