import { customTheme } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import React, { useRef, useState } from "react";
import { Animated, Dimensions, PanResponder, View } from "react-native";
import CustomText from "../custom_ui/custom_text";
import UserContactCard from "./user_contact_card";
import UserInfoCard from "./user_info_card";

interface SettingsUserCardProps {
  user: User | null;
  setUser?: (user: User) => void;
  otherUser?: boolean;
}

const { width } = Dimensions.get("window");

const SettingsUserCard = ({
  user,
  setUser,
  otherUser = false,
}: SettingsUserCardProps) => {
  const [cardIndex, setCardIndex] = useState(0);

  const position = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        const threshold = width * 0.25;
        if (gesture.dx > threshold) {
          swipe("right");
        } else if (gesture.dx < -threshold) {
          swipe("left");
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const swipe = (direction: "left" | "right") => {
    const x = direction === "left" ? -width : width;

    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCardIndex((prev) => (prev === 0 ? 1 : 0));
      position.setValue({ x: direction === "left" ? width : -width, y: 0 });

      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
      }).start();
    });
  };

  const renderCard = () => {
    switch (cardIndex) {
      case 0:
        return (
          <UserInfoCard user={user} setUser={setUser} otherUser={otherUser} />
        );
      case 1:
        return (
          <UserContactCard
            user={user}
            setUser={setUser}
            otherUser={otherUser}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={{ width: "100%" }}>
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          width: "100%",
          transform: [{ translateX: position.x }],
        }}
      >
        {renderCard()}
      </Animated.View>

      <View
        style={{
          marginTop: 10,
          alignItems: "center",
        }}
      >
        <CustomText style={{ fontSize: 12, fontFamily: "VendSansItalic" }}>
          {cardIndex === 0
            ? "Swipe to see your barter contact info"
            : "Swipe to see your general info"}
        </CustomText>

        <View style={{ flexDirection: "row", gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                cardIndex === 0
                  ? customTheme.colors.secondary
                  : customTheme.colors.primary,
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor:
                cardIndex === 1
                  ? customTheme.colors.secondary
                  : customTheme.colors.primary,
            }}
          />
        </View>
      </View>
    </View>
  );
};

export default SettingsUserCard;
