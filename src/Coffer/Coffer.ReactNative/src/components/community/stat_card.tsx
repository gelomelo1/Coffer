import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { compactNumber } from "@/src/utils/community_format";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Animated, Easing, Text, View } from "react-native";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Counts from 0 up to the value once (instantly when the system asks for reduced motion). */
function useCountUp(value: number) {
  const [shown, setShown] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce || value === 0) {
        setShown(value);
        return;
      }
      anim.setValue(0);
      const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
      Animated.timing(anim, { toValue: value, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => {
        anim.removeListener(id);
        setShown(value);
      });
    });
    return () => {
      cancelled = true;
      anim.stopAnimation();
      anim.removeAllListeners();
    };
  }, [anim, value]);

  return shown;
}

interface StatCardProps {
  icon: IconName;
  label: string;
  value: number;
  sub?: string;
  /** "+3 this week · +15 this month" */
  trend?: string;
  /** Nothing new this month: a flat arrow instead of a rising one. */
  trendFlat?: boolean;
  accent?: boolean;
}

/** One big community number: icon, label, the number (counting up), an optional line under it and the recent change. */
export function StatCard({ icon, label, value, sub, trend, trendFlat = false, accent = false }: StatCardProps) {
  const { i18n } = useTranslation();
  const shown = useCountUp(value);
  const fg = accent ? colors.onPrimary : colors.text;

  return (
    <View
      accessible
      accessibilityLabel={[label, value.toLocaleString(i18n.language), sub, trend].filter(Boolean).join(", ")}
      style={{
        flex: 1,
        minHeight: 128,
        padding: spacing.md,
        gap: spacing.xs,
        borderWidth: borders.width,
        borderColor: colors.border,
        backgroundColor: accent ? colors.primary : colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <MaterialCommunityIcons name={icon} size={20} color={accent ? colors.secondary : colors.primary} />
        <Text style={[typography.label, { color: fg, flexShrink: 1 }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={[typography.display, { color: fg, fontVariant: ["tabular-nums"] }]}>{compactNumber(shown, i18n.language)}</Text>
      {sub ? <Text style={[typography.caption, { color: accent ? colors.onPrimary : colors.textMuted }]}>{sub}</Text> : null}
      {trend ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xxs }}>
          <MaterialCommunityIcons
            name={trendFlat ? "trending-neutral" : "trending-up"}
            size={16}
            color={trendFlat ? (accent ? colors.onPrimary : colors.textMuted) : accent ? colors.secondary : colors.success}
          />
          <Text style={[typography.caption, { color: accent ? colors.onPrimary : colors.text, flex: 1 }]}>{trend}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default StatCard;
