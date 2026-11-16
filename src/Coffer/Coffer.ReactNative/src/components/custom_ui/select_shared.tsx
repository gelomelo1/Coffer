import { borders, colors, fonts, sizes, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Platform, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Field look shared by every select-like control (dropdowns, autocomplete, country field). */
export const selectFieldStyle: ViewStyle = {
  minHeight: sizes.control,
  backgroundColor: colors.surface,
  borderWidth: borders.width,
  borderRadius: 0,
  borderColor: colors.border,
  paddingHorizontal: spacing.sm,
};

export const selectTextStyle: TextStyle = {
  color: colors.text,
  fontFamily: fonts.regular,
  fontSize: 16,
};

/** Android draws the picker's modal edge-to-edge (under the status bar); iOS presents it inside a safe area. */
export function useSelectModalInsets() {
  const insets = useSafeAreaInsets();
  return {
    modalContentContainerStyle: { backgroundColor: colors.bg, paddingTop: Platform.OS === "android" ? insets.top : 0, paddingBottom: Platform.OS === "android" ? insets.bottom : 0 },
  };
}

/** Props spread into react-native-dropdown-picker for the modal list (MODAL mode). */
export const selectModalProps = {
  listMode: "MODAL" as const,
  modalAnimationType: "slide" as const,
  modalContentContainerStyle: { backgroundColor: colors.bg },
  modalTitleStyle: { ...typography.headline, color: colors.text },
  searchContainerStyle: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchTextInputStyle: {
    ...selectTextStyle,
    borderRadius: 0,
    borderWidth: borders.width,
    borderColor: colors.border,
    minHeight: sizes.control,
    paddingHorizontal: spacing.sm,
  },
  searchPlaceholderTextColor: colors.textMuted,
  ArrowDownIconComponent: () => <MaterialIcons name="expand-more" size={sizes.iconMd} color={colors.text} />,
  ArrowUpIconComponent: () => <MaterialIcons name="expand-less" size={sizes.iconMd} color={colors.text} />,
  CloseIconComponent: () => <MaterialIcons name="close" size={28} color={colors.text} />,
};

export function SelectLabel({ label, style }: { label?: string; style?: StyleProp<TextStyle> }) {
  if (!label) return null;
  return <Text style={[typography.label, { color: colors.text, marginBottom: spacing.xxs }, style]}>{label}</Text>;
}

export function SelectError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[typography.meta, { color: colors.danger, marginTop: spacing.xxs }]}>
      {message}
    </Text>
  );
}

/** One 56dp option row in a select modal. */
export function SelectOptionRow({
  label,
  selected,
  muted = false,
  onPress,
  additionalElement,
  additionalElementPlacement = "start",
}: {
  label: string;
  selected: boolean;
  muted?: boolean;
  onPress: () => void;
  additionalElement?: React.ReactNode;
  additionalElementPlacement?: "start" | "end";
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          minHeight: 56,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderBottomWidth: borders.hairline,
          borderBottomColor: colors.borderMuted,
          backgroundColor: selected ? colors.secondary : pressed ? colors.surfaceAlt : colors.bg,
        },
      ]}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {additionalElement && additionalElementPlacement === "start" ? additionalElement : null}
        <Text
          style={[
            typography.body,
            { color: muted ? colors.textMuted : colors.text, flexShrink: 1 },
            selected && { fontFamily: fonts.bold },
            muted && { fontFamily: fonts.italic },
          ]}
        >
          {label}
        </Text>
        {additionalElement && additionalElementPlacement === "end" ? additionalElement : null}
      </View>
      {selected ? <MaterialIcons name="check" size={sizes.iconMd} color={colors.text} /> : null}
    </Pressable>
  );
}

/** Disabled look for select fields (same as text fields: 50% opacity). */
export function disabledWrap(disabled: boolean): StyleProp<ViewStyle> {
  return disabled ? { opacity: 0.5 } : null;
}
