import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useGetData, useGetSingleData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import CollectionSearch from "@/src/types/entities/collection_search";
import ItemSearch from "@/src/types/entities/item_search";
import ItemTagSearch from "@/src/types/entities/item_tags_search";
import MixedSearch from "@/src/types/entities/mixed_search";
import User from "@/src/types/entities/user";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  ScrollView,
  SectionList,
  TouchableOpacity,
  View,
} from "react-native";
import { Divider, Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import FeedSearchItemTagCard from "./feed_card_item_tags_card";
import FeedSearchItemCard from "./feed_seach_item_card";
import FeedSearchUserCard from "./feed_seach_user_card";
import FeedSearchCollectionCard from "./feed_search_collection_card";

interface FeedSearchOverlayProps {
  isFeedSearchOverlayVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

type FeedSectionItem =
  | { type: "user"; data: User }
  | { type: "collection"; data: CollectionSearch }
  | { type: "item"; data: ItemSearch };

interface FeedSection {
  title: string;
  data: FeedSectionItem[];
}

function FeedSearchOverlay({
  isFeedSearchOverlayVisible,
}: FeedSearchOverlayProps) {
  const { user } = useUserStore();
  const { collectionType } = useCollectionStore();

  const [searchText, setSearchText] = useState("");

  const { data: itemTagsSearchData = [], refetch: itemTagsSearchRefetch } =
    useGetData<ItemTagSearch>(
      `${endpoints.feedSearchTag}/${collectionType.id}/${encodeURIComponent(
        searchText
      )}`,
      querykeys.itemTagsSearchData,
      undefined,
      undefined,
      { enabled: false, queryKey: [querykeys.itemTagsSearchData] }
    );

  const { data: mixedSearchData, refetch: mixedSearchRefetch } =
    useGetSingleData<MixedSearch>(
      `${endpoints.feedSearch}/${collectionType.id}/${encodeURIComponent(
        searchText
      )}`,
      querykeys.mixedSearchData,
      undefined,
      undefined,
      undefined,
      { enabled: false, queryKey: [querykeys.mixedSearchData] },
      true
    );

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  const inputRef = useRef<any>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setSearchText("");
    setIsLoading(false);
    setIsTyping(true);
    if (isFeedSearchOverlayVisible.value && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFeedSearchOverlayVisible.value]);

  const handleCloseFeedSearch = () => {
    isFeedSearchOverlayVisible.set(false);
  };

  const hasValue = searchText.length > 0;
  const hasSimpleValue = hasValue && searchText[0] !== "#";
  const hasTagValue = searchText.length > 1 && searchText[0] === "#";

  useEffect(() => {
    setIsLoading(false);
    setIsTyping(true);
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    if (!hasValue) {
      setIsTyping(false);
      return;
    }

    debounceTimeout.current = setTimeout(async () => {
      setIsTyping(false);
      setIsLoading(true);
      if (hasTagValue) {
        await itemTagsSearchRefetch();
      } else {
        await mixedSearchRefetch();
      }
      setIsLoading(false);
    }, 1000);

    // cleanup timeout on unmount or before next effect
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [searchText]);

  useEffect(() => {
    console.log(itemTagsSearchData);
  }, [itemTagsSearchData]);

  return (
    <Overlay
      fullScreen
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
      }}
      isVisible={isFeedSearchOverlayVisible.value}
      onBackdropPress={handleCloseFeedSearch}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <CustomTextInput
          ref={inputRef}
          value={searchText}
          onChangeText={(newValue) => setSearchText(newValue)}
          placeholder="Search collectors, items"
          leftIcon={
            <FontAwesome
              name="search"
              size={18}
              color={customTheme.colors.primary}
            />
          }
        />
        {hasSimpleValue ? (
          <View style={{ height: 40 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 10,
              }}
            >
              <View style={{ flexDirection: "row" }}>
                {["ALL", "USERS", "COLLECTIONS", "ITEMS"].map((title, i) => (
                  <TouchableOpacity
                    key={title}
                    onPress={() => setSelectedTabIndex(i)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderBottomWidth: selectedTabIndex === i ? 3 : 0,
                      borderBottomColor: customTheme.colors.secondary,
                      marginRight: 16, // space evenly between tabs
                    }}
                  >
                    <CustomText
                      style={{
                        fontFamily: "VendSansBold",
                        color:
                          selectedTabIndex === i
                            ? customTheme.colors.secondary
                            : customTheme.colors.primary,
                        fontSize: 14,
                        textAlign: "center",
                      }}
                    >
                      {title}
                    </CustomText>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        <Divider width={2} color={customTheme.colors.primary} />
        {hasSimpleValue || hasTagValue ? (
          isLoading ? (
            <Loading />
          ) : hasTagValue ? (
            itemTagsSearchData.length > 0 && !isTyping ? (
              <FlatList
                data={itemTagsSearchData}
                keyExtractor={(item, index) => `${item.value}-${index}`}
                renderItem={({ item }) => (
                  <FeedSearchItemTagCard
                    currentUser={user!}
                    itemTagsSearch={item}
                    closeOverlay={() => isFeedSearchOverlayVisible.set(false)}
                  />
                )}
                ListHeaderComponent={
                  <View
                    style={{
                      width: "100%",
                      backgroundColor: customTheme.colors.background,
                    }}
                  >
                    <CustomText
                      style={{ fontSize: 18, marginBottom: 5 }}
                    >{`found ${itemTagsSearchData.length}`}</CustomText>
                  </View>
                }
                stickyHeaderIndices={[0]}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                ListFooterComponent={
                  <CustomText
                    style={{
                      textAlign: "center",
                      fontFamily: "VendSansItalic",
                      marginTop: 20,
                    }}
                  >
                    End of results
                  </CustomText>
                }
              />
            ) : isLoading || isTyping ? null : (
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  textAlign: "center",
                  marginTop: 20,
                  color: "red",
                }}
              >
                No results found
              </CustomText>
            )
          ) : // Simple value search: switch by selectedTabIndex
          mixedSearchData && !isTyping ? (
            selectedTabIndex === 0 ? (
              mixedSearchData.foundUsers.length === 0 &&
              mixedSearchData.foundCollections.length === 0 &&
              mixedSearchData.foundItems.length === 0 ? (
                isLoading || isTyping ? null : (
                  <CustomText
                    style={{
                      fontFamily: "VendSansBold",
                      textAlign: "center",
                      marginTop: 20,
                    }}
                  >
                    No results found
                  </CustomText>
                )
              ) : (
                <SectionList<FeedSectionItem, FeedSection>
                  sections={[
                    {
                      title: "Users",
                      data: mixedSearchData.foundUsers.map((u) => ({
                        type: "user" as const,
                        data: u,
                      })),
                    },
                    {
                      title: "Collections",
                      data: mixedSearchData.foundCollections.map((c) => ({
                        type: "collection" as const,
                        data: c,
                      })),
                    },
                    {
                      title: "Items",
                      data: mixedSearchData.foundItems.map((i) => ({
                        type: "item" as const,
                        data: i,
                      })),
                    },
                  ]}
                  keyExtractor={(item, index) => `${item.type}-${index}`}
                  renderItem={({ item }) => {
                    switch (item.type) {
                      case "user":
                        return <FeedSearchUserCard user={item.data} />;
                      case "collection":
                        return (
                          <FeedSearchCollectionCard
                            currentUser={user!}
                            collectionType={collectionType}
                            collectionSearch={item.data}
                            closeOverlay={() =>
                              isFeedSearchOverlayVisible.set(false)
                            }
                          />
                        );
                      case "item":
                        return (
                          <FeedSearchItemCard
                            currentUser={user!}
                            itemSearch={item.data}
                            closeOverlay={() =>
                              isFeedSearchOverlayVisible.set(false)
                            }
                          />
                        );
                    }
                  }}
                  renderSectionHeader={({ section }) => (
                    <View
                      style={{
                        width: "100%",
                        backgroundColor: customTheme.colors.background,
                        marginBottom: section.data.length === 0 ? 0 : 5,
                      }}
                    >
                      <CustomText
                        style={{ fontFamily: "VendSansBold", fontSize: 20 }}
                      >
                        {section.title}
                        <CustomText
                          style={{ fontFamily: "VendSans", fontSize: 18 }}
                        >{` - found ${section.data.length}`}</CustomText>
                      </CustomText>
                    </View>
                  )}
                  stickySectionHeadersEnabled
                  ListFooterComponent={
                    <CustomText
                      style={{
                        textAlign: "center",
                        fontFamily: "VendSansItalic",
                        marginTop: 20,
                      }}
                    >
                      End of results
                    </CustomText>
                  }
                  ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                />
              )
            ) : selectedTabIndex === 1 ? (
              mixedSearchData.foundUsers.length === 0 ? (
                isLoading || isTyping ? null : (
                  <CustomText
                    style={{
                      fontFamily: "VendSansBold",
                      textAlign: "center",
                      marginTop: 20,
                    }}
                  >
                    No results found
                  </CustomText>
                )
              ) : (
                <FlatList
                  data={mixedSearchData.foundUsers}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={({ item }) => <FeedSearchUserCard user={item} />}
                  ListHeaderComponent={
                    <View
                      style={{
                        width: "100%",
                        backgroundColor: customTheme.colors.background,
                      }}
                    >
                      <CustomText
                        style={{ fontSize: 18, marginBottom: 5 }}
                      >{`found ${mixedSearchData.foundUsers.length}`}</CustomText>
                    </View>
                  }
                  stickyHeaderIndices={[0]}
                  ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                  ListFooterComponent={
                    <CustomText
                      style={{
                        textAlign: "center",
                        fontFamily: "VendSansItalic",
                        marginTop: 20,
                      }}
                    >
                      End of results
                    </CustomText>
                  }
                />
              )
            ) : selectedTabIndex === 2 ? (
              mixedSearchData.foundCollections.length === 0 ? (
                isLoading || isTyping ? null : (
                  <CustomText
                    style={{
                      fontFamily: "VendSansBold",
                      textAlign: "center",
                      marginTop: 20,
                    }}
                  >
                    No results found
                  </CustomText>
                )
              ) : (
                <FlatList
                  data={mixedSearchData.foundCollections}
                  keyExtractor={(item) => item.collection.id}
                  renderItem={({ item }) => (
                    <FeedSearchCollectionCard
                      currentUser={user!}
                      collectionType={collectionType}
                      collectionSearch={item}
                      closeOverlay={() => isFeedSearchOverlayVisible.set(false)}
                    />
                  )}
                  ListHeaderComponent={
                    <View
                      style={{
                        width: "100%",
                        backgroundColor: customTheme.colors.background,
                      }}
                    >
                      <CustomText
                        style={{ fontSize: 18, marginBottom: 5 }}
                      >{`found ${mixedSearchData.foundCollections.length}`}</CustomText>
                    </View>
                  }
                  stickyHeaderIndices={[0]}
                  ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                  ListFooterComponent={
                    <CustomText
                      style={{
                        textAlign: "center",
                        fontFamily: "VendSansItalic",
                        marginTop: 20,
                      }}
                    >
                      End of results
                    </CustomText>
                  }
                />
              )
            ) : mixedSearchData.foundItems.length === 0 ? (
              isLoading || isTyping ? null : (
                <CustomText
                  style={{
                    fontFamily: "VendSansBold",
                    textAlign: "center",
                    marginTop: 20,
                  }}
                >
                  No results found
                </CustomText>
              )
            ) : (
              <FlatList
                data={mixedSearchData.foundItems}
                keyExtractor={(item) => item.item.id.toString()}
                renderItem={({ item }) => (
                  <FeedSearchItemCard
                    currentUser={user!}
                    itemSearch={item}
                    closeOverlay={() => isFeedSearchOverlayVisible.set(false)}
                  />
                )}
                ListHeaderComponent={
                  <View
                    style={{
                      width: "100%",
                      backgroundColor: customTheme.colors.background,
                    }}
                  >
                    <CustomText
                      style={{ fontSize: 18, marginBottom: 5 }}
                    >{`found ${mixedSearchData.foundItems.length}`}</CustomText>
                  </View>
                }
                stickyHeaderIndices={[0]}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                ListFooterComponent={
                  <CustomText
                    style={{
                      textAlign: "center",
                      fontFamily: "VendSansItalic",
                      marginTop: 20,
                    }}
                  >
                    End of results
                  </CustomText>
                }
              />
            )
          ) : isLoading || isTyping ? null : (
            <CustomText
              style={{
                fontFamily: "VendSansBold",
                textAlign: "center",
                marginTop: 20,
              }}
            >
              No results found
            </CustomText>
          )
        ) : null}
      </SafeAreaView>
    </Overlay>
  );
}

export default FeedSearchOverlay;
