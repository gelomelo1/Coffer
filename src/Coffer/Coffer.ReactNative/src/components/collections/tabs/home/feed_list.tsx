import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import Feed from "@/src/types/entities/feed";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
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
  const { user } = useUserStore();

  const [isFeedSeachOverlayVisible, setIsFeedSearchOverlayVisible] =
    useState(false);

  const { data: feedListData, isFetching } = useGetData<Feed>(
    `${endpoints.feed}/${user!.id}`,
    querykeys.feedListData,
  );

  const flatListRef = useRef<FlatList<Feed>>(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  const translateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - INPUT_HEIGHT],
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
            style={{ width: "90%" }}
            onPress={() => setIsFeedSearchOverlayVisible(true)}
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
              />
            )}
            contentContainerStyle={{
              gap: 50,
              backgroundColor: customTheme.colors.background,
              marginTop: HEADER_HEIGHT,
              paddingBottom: HEADER_HEIGHT + 2 * INPUT_HEIGHT,
              paddingHorizontal: 10,
              paddingTop: 10,
            }}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
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
