import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import { customTheme } from "@/src/theme/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import React, { useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

const HEADER_HEIGHT = 200;
const INPUT_HEIGHT = 60;

function FeedList() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const data = [...Array(100).keys()];

  // Input moves up until it hits top
  const translateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - INPUT_HEIGHT],
    outputRange: [0, -(HEADER_HEIGHT - INPUT_HEIGHT - 20)],
    extrapolate: "clamp",
  });

  // Optional: fade image
  const imageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - INPUT_HEIGHT],
    outputRange: [0.6, 0.2],
    extrapolate: "clamp",
  });

  // Optional: fade image
  const textOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - INPUT_HEIGHT],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Move list content up along with input
  const listTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - INPUT_HEIGHT],
    outputRange: [0, HEADER_HEIGHT - 2 * INPUT_HEIGHT],
    extrapolate: "clamp",
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ backgroundColor: "black", height: HEADER_HEIGHT }}>
        <Animated.View
          style={{ position: "relative", width: "100%", height: "100%" }}
        >
          <Animated.View
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              justifyContent: "center",
              alignItems: "flex-start",
              opacity: textOpacity, // animated separately
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
          {/* Background image */}
          <Animated.Image
            source={require("../../../../../assets/images/home_background.jpg")}
            style={[
              styles.image,
              { width: "100%", height: "100%", opacity: imageOpacity },
            ]}
          />
        </Animated.View>
      </View>

      {/* Sticky Input */}
      <Animated.View
        style={[styles.inputContainer, { transform: [{ translateY }] }]}
      >
        <CustomTextInput
          placeholder="Search collectors, items"
          containerStyle={{
            width: "90%",
          }}
          leftIcon={
            <FontAwesome
              name="search"
              size={18}
              color={customTheme.colors.primary}
            />
          }
        />
      </Animated.View>

      {/* Scrollable List */}
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
          data={data}
          keyExtractor={(item) => item.toString()}
          renderItem={({ item }) => (
            <View style={{ padding: 16 }}>
              <CustomText>{item}</CustomText>
            </View>
          )}
          contentContainerStyle={{
            backgroundColor: customTheme.colors.background,
            marginTop: HEADER_HEIGHT, // initial space below image
            paddingBottom: HEADER_HEIGHT + 2 * INPUT_HEIGHT,
          }}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true } // safe now, no height/padding animation
          )}
          ListEmptyComponent={<Loading />}
        />
      </Animated.View>
    </View>
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
