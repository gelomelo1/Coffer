import CustomDropdownMultiple from "@/src/components/custom_ui/custom_dropdown_multiple";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import { asyncstoragekeys } from "@/src/const/async_storage_keys";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import Feed from "@/src/types/entities/feed";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import FeedCard from "./feed_card";
import FeedSearchOverlay from "./feed_search_overlay";

const HEADER_HEIGHT = 200;
const INPUT_HEIGHT = 60;

function FeedList() {
  const { collectionTypes } = useCollectionTypeStore();
  const { token, user } = useUserStore();

  const [pendingRefetch, setPendingRefetch] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedCollectionTypeIds, setSelectedCollectionTypeIds] = useState<
    number[] | null
  >([]);
  const [isFeedSeachOverlayVisible, setIsFeedSearchOverlayVisible] =
    useState(false);

  const [initialSearchText, setInitialSearchText] = useState<
    string | undefined
  >();

  const dropdownItems = collectionTypes.map((type) => ({
    label: type.name,
    value: type.id,
    additionalElement: (
      <Image
        source={{
          uri: `${endpoints.icons}/${type.icon}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "reload",
        }}
        style={{
          width: 28,
          height: 28,
        }}
      />
    ),
  }));

  const {
    data: feedListData,
    isFetching,
    refetch,
  } = useGetData<Feed>(
    `${endpoints.feed}`,
    querykeys.feedListData,
    selectedCollectionTypeIds && selectedCollectionTypeIds.length > 0
      ? {
          filters: selectedCollectionTypeIds.map((id) => ({
            filter: "==",
            field: "Collection.CollectionTypeId",
            value: id,
          })),
          filterConjunction: "OR",
        }
      : undefined,
  );

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const stored = await AsyncStorage.getItem(
          asyncstoragekeys.feedCollectionTypeFilters,
        );
        if (stored) {
          setPendingRefetch(true);
          const parsed: number[] = JSON.parse(stored);
          setSelectedCollectionTypeIds(parsed);
        } else {
          setSelectedCollectionTypeIds([]);
        }
      } catch (error) {
        console.error("Failed to load collection type filters", error);
        setSelectedCollectionTypeIds([]); // fallback
      }
    };

    loadFilters();
  }, []);

  const handleFilterSelect = async () => {
    await AsyncStorage.setItem(
      asyncstoragekeys.feedCollectionTypeFilters,
      JSON.stringify(selectedCollectionTypeIds),
    );
    await refetch();
  };

  const handleSearchOverlayClose = (
    searchSelectedCollectionTypeIds: number[] | null,
  ) => {
    if (
      selectedCollectionTypeIds!.length !==
        searchSelectedCollectionTypeIds!.length ||
      !selectedCollectionTypeIds!.every(
        (id, index) => id === searchSelectedCollectionTypeIds![index],
      )
    ) {
      setSelectedCollectionTypeIds([...searchSelectedCollectionTypeIds!]);
      setPendingRefetch(true);
    }
  };

  useEffect(() => {
    const loadFilters = async () => {
      if (pendingRefetch) {
        refetch();
        setPendingRefetch(false);
      }
    };

    loadFilters();
  }, [selectedCollectionTypeIds, pendingRefetch, refetch]);

  const flatListRef = useRef<FlatList<Feed>>(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  const translateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT + 80],
    outputRange: [0, -(HEADER_HEIGHT - INPUT_HEIGHT - 20)],
    extrapolate: "clamp",
  });

  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - INPUT_HEIGHT],
    outputRange: [0.6, 0.2],
    extrapolate: "clamp",
  });

  const textOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - INPUT_HEIGHT],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const listTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - INPUT_HEIGHT],
    outputRange: [0, HEADER_HEIGHT - 2 * INPUT_HEIGHT],
    extrapolate: "clamp",
  });

  const handleOpenSearchOverlay = (initialText?: string) => {
    setInitialSearchText(initialText);

    setIsFeedSearchOverlayVisible(true);
  };

  return (
    <>
      <View style={{ flex: 1 }}>
        <View style={{ backgroundColor: "black", height: HEADER_HEIGHT }}>
          <Animated.View
            style={{ position: "relative", width: "100%", height: "100%" }}
          >
            <Animated.View
              style={{
                position: "absolute",
                top: "40%",
                right: 10,
                justifyContent: "center",
                opacity: textOpacity,
                zIndex: 1,
              }}
            >
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  color: customTheme.colors.background,
                  fontSize: 14,
                }}
              >
                Recent posts
              </CustomText>
              {isFetching ? (
                <ActivityIndicator
                  size={"small"}
                  color={customTheme.colors.background}
                />
              ) : (
                <CustomText
                  style={{
                    fontFamily: "VendSansBold",
                    color: customTheme.colors.background,
                    fontSize: 14,
                    textAlign: "center",
                  }}
                >
                  {feedListData?.length}
                </CustomText>
              )}
            </Animated.View>
            <Animated.View
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                justifyContent: "center",
                alignItems: "flex-start",
                opacity: textOpacity,
                zIndex: 1,
              }}
            >
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  color: customTheme.colors.background,
                  fontSize: 28,
                }}
              >
                Explore
              </CustomText>
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  color: customTheme.colors.secondary,
                  fontSize: 36,
                }}
              >
                community
              </CustomText>
              <CustomText
                style={{
                  fontFamily: "VendSansBold",
                  color: customTheme.colors.background,
                  fontSize: 28,
                }}
              >
                finds!
              </CustomText>
            </Animated.View>
            <Animated.Image
              source={require("../../../../../assets/images/home_background.jpg")}
              style={[
                styles.image,
                { width: "100%", height: "100%", opacity: imageOpacity },
              ]}
            />
          </Animated.View>
        </View>

        <Animated.View
          style={[styles.inputContainer, { transform: [{ translateY }] }]}
        >
          <TouchableOpacity
            style={{
              width: "90%",
              padding: 0,
              paddingBottom: 0,
              height: 59,
            }}
            onPress={() => handleOpenSearchOverlay()}
          >
            <CustomTextInput
              placeholder="Search collectors, items"
              leftIcon={
                <FontAwesome
                  name="search"
                  size={18}
                  color={customTheme.colors.primary}
                />
              }
              editable={false}
            />
          </TouchableOpacity>

          <Animated.View
            style={{
              width: "100%",
              alignSelf: "center",
              borderRadius: 20,
            }}
          >
            <CustomDropdownMultiple
              value={selectedCollectionTypeIds}
              open={open}
              setOpen={setOpen}
              setValue={setSelectedCollectionTypeIds}
              items={dropdownItems}
              placeholder="Collection type"
              modalTitle="Filter your feed by Collection type"
              multipleText={
                selectedCollectionTypeIds!.length > 0
                  ? `Collection type (${selectedCollectionTypeIds?.length})`
                  : undefined
              }
              onClose={handleFilterSelect}
              containerStyle={{
                paddingHorizontal: 5,
                paddingVertical: 10,
                backgroundColor: customTheme.colors.background,
                borderRadius: 20,
              }}
              style={{ height: 36, minHeight: 36, borderRadius: 10 }}
            />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: "hidden",
            transform: [{ translateY: listTranslateY }],
          }}
        >
          <Animated.FlatList
            data={feedListData}
            showsVerticalScrollIndicator={false}
            ref={flatListRef}
            keyExtractor={(item) => item.item.id}
            renderItem={({ item }) => (
              <FeedCard
                user={user!}
                collectionType={
                  collectionTypes.find(
                    (ct) => ct.id === item.collection.collectionTypeId,
                  )!
                }
                feed={item}
                onTagPress={handleOpenSearchOverlay}
              />
            )}
            contentContainerStyle={{
              gap: 50,
              backgroundColor: customTheme.colors.background,
              marginTop: HEADER_HEIGHT,
              paddingBottom: HEADER_HEIGHT + 2 * INPUT_HEIGHT,
              paddingHorizontal: 10,
              paddingTop: 80,
            }}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              {
                useNativeDriver: true,
              },
            )}
            ListEmptyComponent={
              isFetching ? (
                <Loading />
              ) : (
                <CustomText
                  style={{
                    fontFamily: "VendSansItalic",
                    marginTop: 50,
                    textAlign: "center",
                  }}
                >
                  No recent activity! See what’s new later
                </CustomText>
              )
            }
            ListFooterComponent={
              feedListData && feedListData.length > 0 ? (
                <CustomText
                  style={{
                    fontFamily: "VendSansItalic",
                    marginTop: 50,
                    textAlign: "center",
                  }}
                >
                  All caught up! See what’s new later
                </CustomText>
              ) : null
            }
          />
        </Animated.View>
      </View>
      <FeedSearchOverlay
        isFeedSearchOverlayVisible={{
          value: isFeedSeachOverlayVisible,
          set: setIsFeedSearchOverlayVisible,
        }}
        selectedCollectionTypeIds={selectedCollectionTypeIds}
        onClose={handleSearchOverlayClose}
        initialSearchText={initialSearchText}
      />
    </>
  );
}

export default FeedList;

const styles = StyleSheet.create({
  image: {
    position: "absolute",
    top: 0,
    width: "100%",
    height: HEADER_HEIGHT,
  },
  inputContainer: {
    position: "absolute",
    top: HEADER_HEIGHT - INPUT_HEIGHT,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
});
