import { colors, fonts, spacing } from "@/src/theme/theme";
import { readableTextOn } from "@/src/utils/contrast";
import { StyleProp, Text, View, ViewStyle } from "react-native";

interface TagProps {
  label: string;
  color?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Small status label ("SELL", "SOLD", …). Always carries text, so meaning never depends on color alone.
 * Without an explicit textColor it picks navy or cream, whichever reads better on `color` (user-chosen type colors).
 */
export function Tag({ label, color = colors.primary, textColor, style }: TagProps) {
  const fg = textColor ?? readableTextOn(color, colors.onSecondary, colors.onPrimary);
  return (
    <View
      style={[
        { backgroundColor: color, paddingHorizontal: spacing.xs, paddingVertical: 2, alignSelf: "flex-start", maxWidth: "100%" },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ color: fg, fontSize: 12, lineHeight: 16, letterSpacing: 0.5, fontFamily: fonts.bold }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export default Tag;
