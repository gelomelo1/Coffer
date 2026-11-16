import { colors, fonts, spacing } from "@/src/theme/theme";
import { StyleProp, Text, View, ViewStyle } from "react-native";

interface TagProps {
  label: string;
  color?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** Small status label ("SELL", "SOLD", …). Always carries text, so meaning never depends on color alone. */
export function Tag({ label, color = colors.primary, textColor = colors.onPrimary, style }: TagProps) {
  return (
    <View
      style={[
        { backgroundColor: color, paddingHorizontal: spacing.xs, paddingVertical: 2, alignSelf: "flex-start", maxWidth: "100%" },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ color: textColor, fontSize: 12, lineHeight: 16, letterSpacing: 0.5, fontFamily: fonts.bold }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export default Tag;
