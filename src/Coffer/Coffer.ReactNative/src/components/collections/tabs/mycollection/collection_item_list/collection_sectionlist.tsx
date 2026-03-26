import CustomText from "@/src/components/custom_ui/custom_text";
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
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
  View,
} from "react-native";
import CollectionInfoCard from "../collection_info/collection_info_card";
import CollectionItemListCard from "./collection_item_list_card";
import CollectionItemHeader from "./collection_list_header";

interface CollectionSectionListProps {
  collectionType: CollectionType;
  collection: Collection;
  items: ItemProvided[];
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
  attributes,
  allLoading,
  queryOptions,
}: CollectionSectionListProps) {
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
            <>
              <View
                style={{
                  justifyContent: "center",
                  alignItems: "center",
                  marginHorizontal: 10,
                  marginTop: 20,
                }}
              >
                <CustomText
                  style={{ fontFamily: "VendSansBold", fontSize: 20 }}
                >
                  No item found
                </CustomText>
                <CustomText style={{ textAlign: "center" }}>
                  {queryOptions.value.filters
                    ? `Adjust your filter to see different results`
                    : "Let's start adding items to your collection, by pressing the + button on the bottom right."}
                </CustomText>
              </View>
            </>
          ) : null}
        </>
      )}
      renderItem={({ item }) => (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
            marginHorizontal: 10,
          }}
        >
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
      ListFooterComponent={
        <CustomText
          style={{
            textAlign: "center",
            fontFamily: "VendSansItalic",
            marginTop: 20,
            marginBottom: 20,
          }}
        >
          End of list
        </CustomText>
      }
      contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  );
}

export default CollectionSectionList;
