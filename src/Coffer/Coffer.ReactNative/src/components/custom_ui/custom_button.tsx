import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, fonts, sizes, spacing } from "@/src/theme/theme";
import React from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";

export interface CustomButtonProps {
  title: string;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  loading?: boolean;
  disabled?: boolean;
  /** Leading icon element. */
  icon?: React.ReactNode;
  iconRight?: boolean;
  /** Outer box (margins, width, alignSelf). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Alias of containerStyle kept for existing call sites. */
  style?: StyleProp<ViewStyle>;
  /** Inner face (background, padding). */
  buttonStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

const palette: Record<ButtonVariant, { bg: string; fg: string; border: string; shadow: boolean }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary, shadow: true },
  secondary: { bg: colors.secondary, fg: colors.onSecondary, border: colors.primary, shadow: true },
  outline: { bg: colors.bg, fg: colors.text, border: colors.primary, shadow: true },
  danger: { bg: colors.danger, fg: colors.onPrimary, border: colors.primary, shadow: true },
  ghost: { bg: "transparent", fg: colors.text, border: "transparent", shadow: false },
};

/** Square retro button. Hard shadow at rest, sinks into it while pressed, flat + 50% when disabled. */
function CustomButton({
  title,
  onPress,
  onLongPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  iconRight = false,
  containerStyle,
  style,
  buttonStyle,
  titleStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: CustomButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  const height = size === "md" ? sizes.control : sizes.controlSm;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === "sm" ? 4 : undefined}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          backgroundColor: p.bg,
          borderColor: p.border,
          opacity: disabled ? 0.5 : 1,
          paddingHorizontal: size === "md" ? spacing.md : spacing.sm,
        },
        p.shadow ? pressableShadowStyle(pressed, inactive) : pressed ? { opacity: 0.6 } : null,
        style,
        containerStyle,
        buttonStyle,
      ]}
    >
      <View style={[styles.content, iconRight && { flexDirection: "row-reverse" }]}>
        {loading ? <ActivityIndicator size="small" color={p.fg} /> : icon}
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            { color: p.fg, fontSize: size === "md" ? 16 : 14, lineHeight: size === "md" ? 20 : 18 },
            variant === "ghost" && { textDecorationLine: "underline" },
            titleStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "stretch",
    borderWidth: borders.width,
    borderRadius: 0,
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.bold,
    textAlign: "center",
    flexShrink: 1,
  },
});

export default CustomButton;
