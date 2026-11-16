import { Chip } from "@/src/components/custom_ui/chip";
import CustomIconButton from "@/src/components/custom_ui/custom_icon_button";
import { asyncstoragekeys } from "@/src/const/async_storage_keys";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { Collection } from "@/src/types/entities/collection";
import { ItemProvided } from "@/src/types/entities/item";
import ItemTag from "@/src/types/entities/item_tag";
import User from "@/src/types/entities/user";
import ItemsLayoutMode from "@/src/types/helpers/items_layout_mode";
import { QueryOptions } from "@/src/types/helpers/query_data";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
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
  layoutMode: {
    value: ItemsLayoutMode;
    set: React.Dispatch<React.SetStateAction<ItemsLayoutMode>>;
  };
  user?: User;
}

function CollectionItemHeader({
  items,
  collection,
  attributes,
  queryOptions,
  isStickyShadow,
  layoutMode,
  user = undefined,
}: CollectionItemHeaderProps) {
  const { t } = useTranslation();
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

  const handleLayoutPress = async () => {
    const newLayoutMode: ItemsLayoutMode =
      layoutMode.value === "two" ? "three" : "two";

    layoutMode.set(newLayoutMode);

    await AsyncStorage.setItem(asyncstoragekeys.itemsLayoutMode, newLayoutMode);
  };

  const activeFilters = queryOptions.value.filters?.length ?? 0;

  return (
    <View
      style={{
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
        borderBottomWidth: isStickyShadow ? borders.width : 0,
        borderBottomColor: colors.border,
      }}
    >
      <CollectionItemListNumbers items={items} queryOptions={queryOptions.value} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text, flex: 1 }]} numberOfLines={2}>
          {user ? t("collections:items.titleOther", { user: user.name, type: collectionType?.name ?? "" }) : t("collections:items.titleOwn", { type: collectionType?.name ?? "" })}
        </Text>
        <CustomIconButton
          variant="plain"
          iconName="layout"
          iconType="feather"
          accessibilityLabel={layoutMode.value === "two" ? t("collections:items.layoutThree") : t("collections:items.layoutTwo")}
          onPress={handleLayoutPress}
        />
        <Chip
          label={activeFilters > 0 ? t("collections:items.filterCount", { count: activeFilters }) : t("collections:items.filter")}
          selected={activeFilters > 0}
          disabled={isItemTagsFetching}
          icon={isItemTagsFetching ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="filter" size={18} color={colors.text} />}
          onPress={() => setIsCollectionListFilterBottemSheetOpen(true)}
        />
      </View>
      <CollectionListFilterBottomSheet
        isCollectionListFilterBottomSheetOpen={{ value: isCollectionListFilterBottomSheetOpen, set: setIsCollectionListFilterBottemSheetOpen }}
        items={items}
        attributes={attributes}
        setQueryOptions={queryOptions.set}
        itemTags={itemTags.map((tag) => tag.tag)}
      />
    </View>
  );
}

export default CollectionItemHeader;
