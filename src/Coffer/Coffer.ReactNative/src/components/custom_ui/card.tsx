import { borders, colors, spacing, typography } from "@/src/theme/theme";
import React from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";

interface SectionCardProps {
  title?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Border color override (e.g. a status color). */
  accent?: string;
  padded?: boolean;
}

/** Flat, square, 2px bordered container. No shadow — only pressables carry one. */
export function SectionCard({ title, right, children, style, accent, padded = true }: SectionCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderWidth: borders.width,
          borderColor: accent ?? colors.border,
          padding: padded ? spacing.md : 0,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {title || right ? <CardHeader title={title} right={right} /> : null}
      {children}
    </View>
  );
}

export function CardHeader({ title, right }: { title?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
      {title ? (
        <Text style={[typography.title, { color: colors.text, flexShrink: 1 }]} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <View />
      )}
      {right}
    </View>
  );
}

/** Section heading for screens and sheets (uppercase eyebrow). */
export function SectionHeader({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, marginBottom: spacing.xs, gap: spacing.sm },
        style,
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[typography.label, { color: colors.text, letterSpacing: 0.5, textTransform: "uppercase", flexShrink: 1 }]}
      >
        {title}
      </Text>
      {right}
    </View>
  );
}

/** Hairline separator. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: borders.hairline, backgroundColor: colors.borderMuted }, style]} />;
}

export const Card = SectionCard;
export default SectionCard;
