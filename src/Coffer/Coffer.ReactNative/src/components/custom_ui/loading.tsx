import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Image, Text, View } from "react-native";

interface LoadingProps {
  label?: string;
}

/** Full-screen splash-style loader: logo + indeterminate retro progress bar. */
export function LoadingScreen({ label }: LoadingProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(
        Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [progress]);

  const block = trackWidth * 0.3;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg, gap: spacing.xxl, padding: spacing.xxl }}
    >
      <Image
        source={require("../../../assets/images/iconwithlabel.png")}
        style={{ width: "60%", height: "auto", aspectRatio: "1/1" }}
        accessibilityIgnoresInvertColors
      />
      <View style={{ width: "100%", gap: spacing.xs }}>
        {label ? <Text style={[typography.meta, { color: colors.text, textAlign: "center" }]}>{label}</Text> : null}
        <View
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          style={{ height: 12, borderWidth: borders.width, borderColor: colors.primary, backgroundColor: colors.bg, overflow: "hidden" }}
        >
          <Animated.View
            style={{
              width: block,
              height: "100%",
              backgroundColor: colors.secondary,
              transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-block, trackWidth] }) }],
            }}
          />
        </View>
      </View>
    </View>
  );
}

/** Inline "Loading..." with animated dots (used inside lists and sections). */
export const Loading = ({ label }: LoadingProps) => {
  const { t } = useTranslation();
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setDotCount((prev) => (prev + 1) % 4), 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t("common:states.loading")}
      style={{ justifyContent: "center", alignItems: "center", padding: spacing.lg, flexDirection: "row", gap: spacing.xs }}
    >
      <ActivityIndicator color={colors.secondary} />
      <Text style={[typography.title, { color: colors.text }]}>
        {label ?? t("common:states.loading")}
        <Text style={{ color: colors.secondary }}>{".".repeat(dotCount)}</Text>
      </Text>
    </View>
  );
};

/** Blocking overlay spinner for a busy component. */
export function ComponentLoading() {
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t("common:states.loading")}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: "rgba(254,253,240,0.85)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
