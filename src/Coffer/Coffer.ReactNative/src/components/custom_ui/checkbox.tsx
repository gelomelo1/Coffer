import { colors, sizes, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleProp, Text, ViewStyle } from "react-native";

/** Square checkbox row with its label; the whole row is the 48dp touch target. */
export function Checkbox({
  checked,
  onPress,
  label,
  error = false,
  style,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  /** Draws the box in the danger color while a required box is unchecked. */
  error?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minHeight: sizes.touch,
          paddingVertical: spacing.xxs,
          backgroundColor: pressed ? colors.surfaceAlt : "transparent",
        },
        style,
      ]}
    >
      <MaterialIcons
        name={checked ? "check-box" : "check-box-outline-blank"}
        size={sizes.iconMd + 4}
        color={error && !checked ? colors.danger : colors.primary}
      />
      <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

export default Checkbox;
