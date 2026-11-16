import { colors, fonts } from "@/src/theme/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, Text, View } from "react-native";

interface AnimatedTabIconProps {
  focused: boolean;
  title: string;
  icon: { library: "fontawesome" | "materialcommunityicons"; name: string };
  navigate: () => void;
}

/**
 * Bottom tab item: icon + always-visible label. Active tab = 4px gold block on the top edge, gold icon, bold label
 * (indicated by shape and weight as well as color).
 */
function AnimatedTabIcon({ focused, title, icon, navigate }: AnimatedTabIconProps) {
  const iconColor = focused ? colors.secondary : colors.primary;
  const Icon = icon.library === "fontawesome" ? FontAwesome : MaterialCommunityIcons;

  return (
    <Pressable
      onPress={navigate}
      accessibilityRole="tab"
      accessibilityLabel={title}
      accessibilityState={{ selected: focused }}
      style={({ pressed }) => ({
        flex: 1,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        backgroundColor: pressed ? colors.surfaceAlt : "transparent",
      })}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: "20%",
          right: "20%",
          height: 4,
          backgroundColor: focused ? colors.secondary : "transparent",
        }}
      />
      <Icon name={icon.name as any} size={26} color={iconColor} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{
          fontSize: 12,
          lineHeight: 16,
          color: colors.text,
          fontFamily: focused ? fonts.bold : fonts.regular,
          paddingHorizontal: 2,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export default AnimatedTabIcon;
