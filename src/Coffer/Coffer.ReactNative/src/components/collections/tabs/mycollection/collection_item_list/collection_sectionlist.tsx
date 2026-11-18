import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { ItemPaging } from "@/src/hooks/collection_items";
import { EmptyState } from "@/src/components/custom_ui/states";
import { colors, spacing, typography } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import { Loading } from "@/src/components/custom_ui/loading";
import { asyncstoragekeys } from "@/src/const/async_storage_keys";
import Attribute from "@/src/types/entities/attribute";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { ItemProvided } from "@/src/types/entities/item";
import ItemsLayoutMode from "@/src/types/helpers/items_layout_mode";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { chunkArray } from "@/src/utils/data_access_utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, SectionList, Text, View } from "react-native";
import CollectionInfoCard from "../collection_info/collection_info_card";
import CollectionItemListCard from "./collection_item_list_card";
import CollectionItemHeader from "./collection_list_header";

interface CollectionSectionListProps {
  collectionType: CollectionType;
  collection: Collection;
  items: ItemProvided[];
  /** Totals + load more (20 items per page). */
  paging: ItemPaging;
  attributes: Attribute[];
  allLoading: boolean;
  queryOptions: {
    value: QueryOptions;
    set: React.Dispatch<React.SetStateAction<QueryOptions>>;
  };
}

function CollectionSectionList({
  collectionType,
  collection,
  items,
  paging,
  attributes,
  allLoading,
  queryOptions,
}: CollectionSectionListProps) {
  const { t } = useTranslation();
  const [isLayoutModeLoading, setIsLayoutModeLoading] = useState(false);

  const isLoading = allLoading || isLayoutModeLoading;

  const [layoutMode, setLayoutMode] = useState<ItemsLayoutMode>("two");

  const chunkedItems = chunkArray(
    isLoading ? [] : items,
    layoutMode === "two" ? 2 : 3,
  );

  const sections = [{ data: chunkedItems.length > 0 ? chunkedItems : [[]] }];

  const [isStickyShadow, setIsStickyShadow] = useState(false);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;

    setIsStickyShadow(offsetY > 260);
  };

  useEffect(() => {
    const loadLayout = async () => {
      try {
        setIsLayoutModeLoading(true);
        const stored = await AsyncStorage.getItem(
          asyncstoragekeys.itemsLayoutMode,
        );

        if (stored) {
          const parsed = stored as ItemsLayoutMode;
          setLayoutMode(parsed);
        }
      } catch (error) {
        console.error("Failed to load items layout mode", error);
        setLayoutMode("two");
      } finally {
        setIsLayoutModeLoading(false);
      }
    };

    loadLayout();
  }, []);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item, index) =>
        item.map((i) => i.id).join("_") ?? index.toString()
      }
      onScroll={onScroll}
      scrollEventThrottle={16}
      ListHeaderComponent={<CollectionInfoCard />}
      renderSectionHeader={() => (
        <>
          <CollectionItemHeader
            items={items}
            paging={paging}
            collection={collection}
            attributes={attributes}
            queryOptions={queryOptions}
            isStickyShadow={isStickyShadow}
            layoutMode={{
              value: layoutMode,
              set: setLayoutMode,
            }}
          />
          {isLoading && <Loading />}

          {!isLoading && items.length === 0 ? (
            <EmptyState
              icon={queryOptions.value.filters ? "filter-alt-off" : "add-photo-alternate"}
              title={t("collections:items.emptyTitle")}
              text={queryOptions.value.filters ? t("collections:items.emptyFiltered") : t("collections:items.emptyText")}
            />
          ) : null}
        </>
      )}
      renderItem={({ item }) => (
        <View style={{ flexDirection: "row", gap: spacing.md, marginHorizontal: spacing.md }}>
          {item.map((i) => (
            <CollectionItemListCard
              key={i.id}
              item={i}
              collectionType={collectionType}
              layoutMode={layoutMode}
            />
          ))}
        </View>
      )}
      stickySectionHeadersEnabled
      onEndReached={paging.loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        paging.hasMore ? (
          <ListFooterLoading loading />
        ) : items.length > 0 ? (
          <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl }]}>{t("collections:items.endOfList")}</Text>
        ) : null
      }
      contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      style={{ backgroundColor: colors.bg }}
    />
  );
}

export default CollectionSectionList;
