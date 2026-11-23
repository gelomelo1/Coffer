import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { ShareLinkButton } from "@/src/components/custom_ui/share_link_button";
import { ItemPaging } from "@/src/hooks/collection_items";
import { EmptyState } from "@/src/components/custom_ui/states";
import { colors, sizes, spacing, typography } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import { Loading } from "@/src/components/custom_ui/loading";
import { asyncstoragekeys } from "@/src/const/async_storage_keys";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import Attribute from "@/src/types/entities/attribute";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { ItemProvided } from "@/src/types/entities/item";
import User from "@/src/types/entities/user";
import ItemsLayoutMode from "@/src/types/helpers/items_layout_mode";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { chunkArray } from "@/src/utils/data_access_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
  Text,
  View,
} from "react-native";
import CollectionItemListCard from "../collections/tabs/mycollection/collection_item_list/collection_item_list_card";
import CollectionItemHeader from "../collections/tabs/mycollection/collection_item_list/collection_list_header";
import CustomButton from "../custom_ui/custom_button";
import OtherUserCollectionInfoCard from "./other_user_collection_info_card";

interface OtherUserItemSectionListProps {
  currentUser: User;
  user: User;
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

function OtherUserItemSectionList({
  currentUser,
  user,
  collectionType,
  collection,
  items,
  paging,
  attributes,
  allLoading,
  queryOptions,
}: OtherUserItemSectionListProps) {
  const { t } = useTranslation();
  const [isLayoutModeLoading, setIsLayoutModeLoading] = useState(false);

  const isLoading = allLoading || isLayoutModeLoading;

  const [layoutMode, setLayoutMode] = useState<ItemsLayoutMode>("two");

  const { setItem } = useOtherUserStore();

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

  const handleCollectionNavigation = () => {
    navigate({
      pathname: ROUTES.OTHERUSER,
      params: pageParams.otheruser(user.name),
    });
  };

  const handleItemNavigation = (item: ItemProvided) => {
    setItem(item);
    navigate({
      pathname: ROUTES.OTHERUSERITEMDETAILS,
      params: pageParams.otheruseritemdetails(collection.name),
    });
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
      ListHeaderComponent={
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginHorizontal: spacing.md }}>
            <CustomButton
              title={t("settings:otherUser.allCollections", { name: user.name })}
              variant="outline"
              size="sm"
              icon={<MaterialIcons name="person" size={sizes.iconSm} color={colors.text} />}
              containerStyle={{ flexShrink: 1 }}
              onPress={handleCollectionNavigation}
            />
            <ShareLinkButton kind="collection" id={collection.id} />
          </View>
          <OtherUserCollectionInfoCard
            currentUser={currentUser}
            collection={collection}
            collectionType={collectionType}
          />
        </>
      }
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
            user={user}
          />
          {isLoading && <Loading />}

          {!isLoading && items.length === 0 ? (
            <EmptyState
              icon={queryOptions.value.filters ? "filter-alt-off" : "inventory-2"}
              title={t("collections:items.emptyTitle")}
              text={queryOptions.value.filters ? t("collections:items.emptyFiltered") : undefined}
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
              onCardPress={() => handleItemNavigation(i)}
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
      contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl * 2 }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      style={{ backgroundColor: colors.bg }}
    />
  );
}

export default OtherUserItemSectionList;
