import CustomText from "@/src/components/custom_ui/custom_text";
import { customTheme } from "@/src/theme/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useRef } from "react";
import { Animated, Easing, TouchableOpacity } from "react-native";

interface AnimatedTabIconProps {
  focused: boolean;
  title: string;
  icon: { library: "fontawesome" | "materialcommunityicons"; name: string };
  navigate: () => void;
}

function AnimatedTabIcon({
  focused,
  title,
  icon,
  navigate,
}: AnimatedTabIconProps) {
  const translateY = useRef(new Animated.Value(0)).current;

  // Animate down when focus changes (other tab selected)
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: focused ? -2 : 0,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [focused, translateY]);

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <TouchableOpacity
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          minWidth: 80,
        }}
        onPress={() => navigate()}
      >
        {icon.library === "fontawesome" ? (
          <FontAwesome
            name={icon.name as any}
            size={32}
            color={
              focused
                ? customTheme.colors.secondary
                : customTheme.colors.primary
            }
          />
        ) : icon.library === "materialcommunityicons" ? (
          <MaterialCommunityIcons
            name={icon.name as any}
            size={32}
            color={
              focused
                ? customTheme.colors.secondary
                : customTheme.colors.primary
            }
          />
        ) : null}
        {focused && (
          <CustomText
            style={{ fontSize: 10, color: customTheme.colors.secondary }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </CustomText>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default AnimatedTabIcon;
