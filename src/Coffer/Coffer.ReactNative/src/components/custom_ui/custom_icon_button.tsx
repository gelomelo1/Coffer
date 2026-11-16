import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import AppIcon from "./app_icon";

interface CustomIconButtonProps {
  iconName: string;
  /** Icon family, e.g. "materialicons", "entypo", "antdesign", "fontawesome", "materialcommunityicons". */
  iconType?: string;
  onPress: () => void;
  onLongPress?: () => void;
  /** Visible caption under the icon. Also the default accessibility label. */
  title?: string;
  accessibilityLabel?: string;
  /** "filled": square tile with border + shadow (default). "plain": bare icon with a 48dp hit area. */
  variant?: "filled" | "plain";
  /** Filled: tile color. Plain: icon color. */
  color?: string;
  /** Filled: icon color. */
  reverseColor?: string;
  disabled?: boolean;
  /** Icon size. */
  size?: number;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

function CustomIconButton({
  iconName,
  iconType = "materialicons",
  title,
  onPress,
  onLongPress,
  accessibilityLabel,
  variant = "filled",
  color,
  reverseColor,
  disabled = false,
  size = sizes.iconMd,
  selected,
  style,
}: CustomIconButtonProps) {
  const filled = variant === "filled";
  const tile = Math.max(sizes.touch, size + spacing.md);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled, selected }}
      hitSlop={filled ? undefined : Math.max(0, (sizes.touch - size) / 2)}
      style={[{ alignItems: "center", gap: spacing.xxs, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {({ pressed }) => (
        <>
          <View
            style={[
              { width: filled ? tile : size, height: filled ? tile : size, alignItems: "center", justifyContent: "center" },
              filled && {
                backgroundColor: color ?? colors.primary,
                borderWidth: borders.width,
                borderColor: colors.primary,
                ...pressableShadowStyle(pressed, disabled),
              },
              !filled && pressed && { opacity: 0.5 },
            ]}
          >
            <AppIcon
              name={iconName}
              family={iconType}
              size={size}
              color={filled ? (reverseColor ?? colors.secondary) : (color ?? colors.text)}
            />
          </View>
          {title ? (
            <Text style={[typography.meta, { color: colors.text, textAlign: "center" }]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export default CustomIconButton;
