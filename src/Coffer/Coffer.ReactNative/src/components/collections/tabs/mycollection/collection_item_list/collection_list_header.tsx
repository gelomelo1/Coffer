import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { Collection } from "@/src/types/entities/collection";
import { ItemProvided } from "@/src/types/entities/item";
import ItemTag from "@/src/types/entities/item_tag";
import User from "@/src/types/entities/user";
import { QueryOptions } from "@/src/types/helpers/query_data";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import CollectionItemListNumbers from "./collection_item_list_numbers";
import CollectionListFilterBottomSheet from "./collection_list_filter_bottomsheet";

interface CollectionItemHeaderProps {
  items: ItemProvided[];
  collection: Collection;
  attributes: Attribute[];
  queryOptions: {
    value: QueryOptions;
    set: React.Dispatch<React.SetStateAction<QueryOptions>>;
  };
  isStickyShadow: boolean;
  user?: User;
}

function CollectionItemHeader({
  items,
  collection,
  attributes,
  queryOptions,
  isStickyShadow,
  user = undefined,
}: CollectionItemHeaderProps) {
  const { collectionType } = useCollectionStore();

  const { data: itemTags = [], isFetching: isItemTagsFetching } =
    useGetData<ItemTag>(
      `${endpoints.collectionItemTags}/${collection!.id}`,
      `${querykeys.itemTagsData}${collection!.id}`,
    );

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
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexShrink: 1,
          }}
        >
          <CustomText
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              fontSize: 20,
              flexShrink: 1,
            }}
          >
            {user ? `${user.name}'s ` : "Your "}
            <CustomText
              style={{
                fontSize: 24,
                fontFamily: "VendSansBold",
                color: customTheme.colors.secondary,
              }}
            >
              {collectionType!.name}
            </CustomText>{" "}
            collection
          </CustomText>
        </View>

        {isItemTagsFetching ? (
          <ActivityIndicator color={customTheme.colors.primary} />
        ) : (
          <TouchableOpacity
            style={{
              justifyContent: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginLeft: 10,
            }}
            onPress={() => setIsCollectionListFilterBottemSheetOpen(true)}
          >
            <CustomText style={{ fontSize: 20 }}>Filter</CustomText>
            <Ionicons
              name="filter"
              size={24}
              color={customTheme.colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>
      <CollectionListFilterBottomSheet
        isCollectionListFilterBottomSheetOpen={{
          value: isCollectionListFilterBottomSheetOpen,
          set: setIsCollectionListFilterBottemSheetOpen,
        }}
        items={items}
        attributes={attributes}
        setQueryOptions={queryOptions.set}
        itemTags={itemTags.map((tag) => tag.tag)}
      />
    </View>
  );
}

export default CollectionItemHeader;
