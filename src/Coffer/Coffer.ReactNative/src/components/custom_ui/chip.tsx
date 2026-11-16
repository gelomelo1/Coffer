import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, fonts, spacing } from "@/src/theme/theme";
import React from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Toggle chip for filters and option pickers. Selected = gold fill + bold, sunk (no shadow). */
export function Chip({ label, selected = false, onPress, disabled = false, icon, style, accessibilityLabel }: ChipProps) {
  const interactive = !!onPress && !disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xxs,
          minHeight: 40,
          maxWidth: "100%",
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
          borderWidth: borders.width,
          borderColor: colors.primary,
          backgroundColor: selected ? colors.secondary : colors.bg,
          opacity: disabled ? 0.4 : 1,
        },
        onPress ? pressableShadowStyle(pressed || selected, !interactive) : null,
        style,
      ]}
    >
      {icon}
      <Text
        numberOfLines={2}
        style={{
          flexShrink: 1,
          color: colors.text,
          fontSize: 14,
          lineHeight: 18,
          fontFamily: selected ? fonts.bold : fonts.regular,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Wrapping row of chips — wraps instead of overflowing horizontally. */
export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, style]}>{children}</View>;
}

export default Chip;
