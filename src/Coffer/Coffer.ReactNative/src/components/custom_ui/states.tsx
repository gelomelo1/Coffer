import { colors, fonts, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Animated, DimensionValue, StyleProp, Text, View, ViewStyle } from "react-native";
import CustomButton from "./custom_button";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

export function EmptyState({
  icon,
  title,
  text,
  action,
  style,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.xs }, style]}>
      <MaterialIcons name={icon} size={48} color={colors.secondary} />
      <Text style={[typography.title, { color: colors.text, textAlign: "center" }]}>{title}</Text>
      {text ? <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center" }]}>{text}</Text> : null}
      {action ? (
        <CustomButton title={action.label} onPress={action.onPress} variant="outline" containerStyle={{ alignSelf: "center", marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry, style }: { message: string; onRetry?: () => void; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[{ alignItems: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, gap: spacing.xs }, style]}
    >
      <MaterialIcons name="error-outline" size={48} color={colors.danger} />
      <Text style={[typography.bodyStrong, { color: colors.text, textAlign: "center" }]}>{message}</Text>
      {onRetry ? (
        <CustomButton title={t("common:actions.retry")} onPress={onRetry} variant="outline" containerStyle={{ alignSelf: "center", marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

/** Inline form/field error message in danger color. */
export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={{ color: colors.danger, fontSize: 14, lineHeight: 20, fontFamily: fonts.regular }}>
      {children}
    </Text>
  );
}

/** Field label. */
export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<any> }) {
  return <Text style={[typography.label, { color: colors.text, marginTop: spacing.xs }, style]}>{children}</Text>;
}

/** Pulsing placeholder block for loading lists. Static when the user asked for reduced motion. */
export function SkeletonBlock({ width = "100%", height = 16, style }: { width?: DimensionValue; height?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.5, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderMuted, opacity }, style]} />;
}
