import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { ItemProvided } from "@/src/types/entities/item";
import User from "@/src/types/entities/user";
import { QueryOptions } from "@/src/types/helpers/query_data";
import { chunkArray } from "@/src/utils/data_access_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
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
  attributes,
  allLoading,
  queryOptions,
}: OtherUserItemSectionListProps) {
  const { setItem } = useOtherUserStore();

  const chunkedItems = chunkArray(items, 2);

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
          <CustomButton
            title={"Go to user's collections list"}
            icon={
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={customTheme.colors.secondary}
                style={{ marginRight: 5 }}
              />
            }
            containerStyle={{ marginBottom: 10, marginHorizontal: 10 }}
            onPress={handleCollectionNavigation}
          />
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
            collection={collection}
            attributes={attributes}
            queryOptions={queryOptions}
            isStickyShadow={isStickyShadow}
            user={user}
          />
          {allLoading && <Loading />}

          {!allLoading && items.length === 0 ? (
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
                    : ""}
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
              onCardPress={() => handleItemNavigation(i)}
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

export default OtherUserItemSectionList;
