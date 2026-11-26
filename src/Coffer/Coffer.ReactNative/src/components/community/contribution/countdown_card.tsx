import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { clockOffset, elapsedShare, pad2, remaining } from "@/src/utils/contribution_format";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

/**
 * Time left in the running phase: days + hh:mm:ss ticking every second, and how much of the round has passed. Follows
 * the server's clock (serverNow), so a wrong phone clock can't end it early. Calls onEnded once at zero.
 */
export function CountdownCard({ openedAt, endsAt, serverNow, onEnded }: { openedAt: string; endsAt: string; serverNow: string; onEnded: () => void }) {
  const { t, i18n } = useTranslation();
  const offset = useMemo(() => clockOffset(serverNow, Date.now()), [serverNow]);
  const [now, setNow] = useState(() => Date.now());
  const ended = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = remaining(endsAt, offset, now);
  const share = elapsedShare(openedAt, endsAt, offset, now);
  useEffect(() => {
    if (left.totalMs === 0 && !ended.current) {
      ended.current = true;
      onEnded();
    }
  }, [left.totalMs, onEnded]);

  const ends = new Date(endsAt).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const label = t("community:shape.countdown.a11y", { days: left.days, hours: left.hours, minutes: left.minutes });

  return (
    <View style={{ gap: spacing.xs, padding: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
      <View accessible accessibilityRole="timer" accessibilityLabel={left.totalMs > 0 ? label : t("community:shape.countdown.ended")}
        style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
        <MaterialCommunityIcons name="timer-sand" size={22} color={colors.secondary} style={{ alignSelf: "center" }} />
        <Text style={[typography.display, { color: colors.text, fontVariant: ["tabular-nums"] }]}>
          {left.days}
          <Text style={[typography.title, { color: colors.textMuted }]}> {t("community:shape.countdown.days")}  </Text>
          {pad2(left.hours)}:{pad2(left.minutes)}:{pad2(left.seconds)}
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("community:shape.countdown.progressA11y")}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
        style={{ height: 12, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}
      >
        <View style={{ width: `${share * 100}%`, height: "100%", backgroundColor: colors.secondary }} />
      </View>
      <Text style={[typography.meta, { color: colors.textMuted }]}>{t("community:shape.countdown.ends", { date: ends })}</Text>
    </View>
  );
}
