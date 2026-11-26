import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { ResultRow } from "@/src/types/entities/contribution";
import { shareLabel } from "@/src/utils/contribution_format";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

/**
 * One bar per candidate: name, share and votes. The winner (a closed vote) gets the accent bar; the user's own pick (a
 * running vote) is named in text, so neither relies on colour alone.
 */
export function ResultBars({ rows, winnerId, mineId }: { rows: ResultRow[]; winnerId?: string | null; mineId?: string | null }) {
  const { t, i18n } = useTranslation();
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row) => {
        const won = row.candidateId === winnerId;
        const mine = row.candidateId === mineId;
        const share = shareLabel(row.share, i18n.language);
        const votes = t("community:shape.latest.votes", { count: row.votes });
        const a11y = won ? "community:shape.latest.winnerA11y" : mine ? "community:shape.live.mineA11y" : "community:shape.latest.rowA11y";
        return (
          <View key={row.candidateId} accessible accessibilityLabel={t(a11y, { name: row.name, share, votes })} style={{ gap: spacing.xxs }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
              <Text style={[won || mine ? typography.label : typography.meta, { color: colors.text, flex: 1 }]}>
                {row.name}
                {mine ? <Text style={[typography.meta, { color: colors.textMuted }]}> · {t("community:shape.live.yours")}</Text> : null}
              </Text>
              <Text style={[typography.meta, { color: colors.textMuted, fontVariant: ["tabular-nums"] }]}>
                {share} · {votes}
              </Text>
            </View>
            <View style={{ height: 10, borderWidth: borders.hairline, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
              <View style={{ width: `${row.share * 100}%`, height: "100%", backgroundColor: won || mine ? colors.secondary : colors.borderMuted }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
