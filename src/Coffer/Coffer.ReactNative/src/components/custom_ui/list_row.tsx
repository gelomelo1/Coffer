import { colors, sizes, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

interface ListRowProps {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  titleLines?: number;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Text-dominant list row: leading media, title (wraps), subtitle/meta, trailing action or chevron. */
export function ListRow({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  titleLines = 2,
  destructive = false,
  style,
}: ListRowProps) {
  const body = (
    <>
      {leading ? <View style={{ alignItems: "center", justifyContent: "center" }}>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={titleLines}
          style={[typography.bodyStrong, { color: destructive ? colors.danger : colors.text }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={[typography.meta, { color: colors.text }]}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <MaterialIcons name="chevron-right" size={sizes.iconMd} color={colors.text} /> : null)}
    </>
  );

  const rowStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  };

  if (!onPress && !onLongPress) return <View style={[rowStyle, style]}>{body}</View>;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.surfaceAlt }, style]}
    >
      {body}
    </Pressable>
  );
}

export default ListRow;
