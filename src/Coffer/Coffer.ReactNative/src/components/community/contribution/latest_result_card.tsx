import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { LatestResult } from "@/src/types/entities/contribution";
import { shareLabel } from "@/src/utils/contribution_format";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

/** The last vote's outcome: the winner (trophy + text, not colour alone) and every candidate's share. */
export function LatestResultCard({ result }: { result: LatestResult }) {
  const { t, i18n } = useTranslation();
  const winner = result.rows.find((r) => r.candidateId === result.winnerCandidateId);
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
      <Text style={[typography.title, { color: colors.text }]}>{t("community:shape.latest.title")}</Text>
      {winner ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <MaterialCommunityIcons name="trophy" size={22} color={colors.secondary} />
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("community:shape.latest.winner", { name: winner.name })}</Text>
        </View>
      ) : null}
      {result.rows.map((row) => {
        const won = row.candidateId === result.winnerCandidateId;
        const share = shareLabel(row.share, i18n.language);
        const votes = t("community:shape.latest.votes", { count: row.votes });
        return (
          <View
            key={row.candidateId}
            accessible
            accessibilityLabel={t(won ? "community:shape.latest.winnerA11y" : "community:shape.latest.rowA11y", { name: row.name, share, votes })}
            style={{ gap: spacing.xxs }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
              <Text style={[won ? typography.label : typography.meta, { color: colors.text, flex: 1 }]}>{row.name}</Text>
              <Text style={[typography.meta, { color: colors.textMuted, fontVariant: ["tabular-nums"] }]}>
                {share} · {votes}
              </Text>
            </View>
            <View style={{ height: 10, borderWidth: borders.hairline, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
              <View style={{ width: `${row.share * 100}%`, height: "100%", backgroundColor: won ? colors.secondary : colors.borderMuted }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
