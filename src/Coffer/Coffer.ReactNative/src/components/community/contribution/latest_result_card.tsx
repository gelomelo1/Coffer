import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { LatestResult, ResultRow } from "@/src/types/entities/contribution";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ResultBars } from "./result_bars";

const cardStyle = { gap: spacing.sm, padding: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface };

/** The last vote's outcome: the winner (trophy + text, not colour alone) and every candidate's share. */
export function LatestResultCard({ result }: { result: LatestResult }) {
  const { t } = useTranslation();
  const winner = result.rows.find((r) => r.candidateId === result.winnerCandidateId);
  return (
    <View style={cardStyle}>
      <Text style={[typography.title, { color: colors.text }]}>{t("community:shape.latest.title")}</Text>
      {winner ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <MaterialCommunityIcons name="trophy" size={22} color={colors.secondary} />
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("community:shape.latest.winner", { name: winner.name })}</Text>
        </View>
      ) : null}
      <ResultBars rows={result.rows} winnerId={result.winnerCandidateId} />
    </View>
  );
}

/** A running vote's standings: how many voted so far and every candidate's share (the user's own pick named). */
export function LiveResultsCard({ rows, mineId }: { rows: ResultRow[]; mineId?: string | null }) {
  const { t } = useTranslation();
  const total = rows.reduce((sum, r) => sum + r.votes, 0);
  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <MaterialCommunityIcons name="chart-bar" size={22} color={colors.secondary} />
        <Text style={[typography.title, { color: colors.text, flex: 1 }]} accessibilityRole="header">
          {t("community:shape.live.title")}
        </Text>
      </View>
      <Text style={[typography.label, { color: colors.text, fontVariant: ["tabular-nums"] }]}>
        {total === 0 ? t("community:shape.live.none") : t("community:shape.live.total", { count: total })}
      </Text>
      {total > 0 ? <ResultBars rows={rows} mineId={mineId} /> : null}
    </View>
  );
}
