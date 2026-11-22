import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { CommunityStats } from "@/src/types/entities/community";
import { chartPath, compactNumber } from "@/src/utils/community_format";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

type Series = "members" | "items" | "collections";
const SERIES: Series[] = ["members", "items", "collections"];
const HEIGHT = 160;
const PAD = 12;

/** Growth over the last 12 weeks, one series at a time; the latest value is labelled on the chart. */
export function GrowthChart({ growth }: { growth: CommunityStats["growth"] }) {
  const { t, i18n } = useTranslation();
  const [series, setSeries] = useState<Series>("members");
  const [width, setWidth] = useState(0);

  const values = growth.map((g) => g[series]);
  const { line, area, points } = chartPath(values, width, HEIGHT, PAD);
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  const label = (s: Series) => t(`community:stats.growth.${s}`);
  const weekLabel = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(i18n.language, { month: "short", day: "numeric" }) : "");
  const summary = t("community:stats.growth.summary", { series: label(series), from: first.toLocaleString(i18n.language), to: last.toLocaleString(i18n.language) });
  const lastPoint = points[points.length - 1];

  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
        {SERIES.map((s) => {
          const active = s === series;
          return (
            <Pressable
              key={s}
              onPress={() => setSeries(s)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                minHeight: 40,
                justifyContent: "center",
                paddingHorizontal: spacing.sm,
                borderWidth: borders.width,
                borderColor: colors.border,
                backgroundColor: active ? colors.primary : pressed ? colors.surfaceAlt : colors.surface,
              })}
            >
              <Text style={[typography.label, { color: active ? colors.onPrimary : colors.text }]}>{label(s)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View accessible accessibilityRole="image" accessibilityLabel={summary} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
        {width > 0 && points.length > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line key={f} x1={0} x2={width} y1={HEIGHT * f} y2={HEIGHT * f} stroke={colors.borderMuted} strokeWidth={1} strokeDasharray="4 6" />
            ))}
            <Path d={area} fill={colors.secondary} fillOpacity={0.25} />
            <Path d={line} stroke={colors.primary} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 6 : 3} fill={i === points.length - 1 ? colors.secondary : colors.primary} stroke={colors.primary} strokeWidth={2} />
            ))}
          </Svg>
        ) : null}
        {lastPoint ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: 0,
              top: Math.max(0, lastPoint.y - 36),
              paddingHorizontal: spacing.xs,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={[typography.label, { color: colors.onPrimary }]}>{compactNumber(last, i18n.language)}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{weekLabel(growth[0]?.weekStart)}</Text>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{t("community:stats.growth.thisWeek")}</Text>
      </View>
      <Text style={[typography.meta, { color: colors.text }]}>{summary}</Text>
    </View>
  );
}

export default GrowthChart;
