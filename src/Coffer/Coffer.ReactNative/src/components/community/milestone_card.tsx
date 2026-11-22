import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { Milestone } from "@/src/types/entities/community";
import { ladderDots, progressRatio } from "@/src/utils/community_format";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * A weekly community goal: this week's target and progress, the streak, where the target sits on its ladder, and the
 * viewer's own part ("you added 4 of 23").
 */
export function MilestoneCard({ milestone, icon }: { milestone: Milestone; icon: IconName }) {
  const { t, i18n } = useTranslation();
  const n = (v: number) => v.toLocaleString(i18n.language);
  const reached = milestone.progress >= milestone.target;
  const ratio = progressRatio(milestone.progress, milestone.target);
  const title = t(`community:stats.milestones.${milestone.key}`);
  const progressText = t("community:stats.milestones.progress", { progress: n(milestone.progress), target: n(milestone.target) });
  const level = t("community:stats.milestones.level", { rung: milestone.rung + 1, rungs: milestone.rungs });

  const mine =
    milestone.key === "itemsAdded"
      ? milestone.mine.count > 0
        ? milestone.mine.count >= milestone.progress
          ? t("community:stats.milestones.mineItemsAll", { count: milestone.mine.count })
          : t("community:stats.milestones.mineItems", { count: milestone.mine.count, total: n(milestone.progress) })
        : t("community:stats.milestones.mineItemsNone")
      : milestone.mine.active
        ? t("community:stats.milestones.mineActive")
        : t("community:stats.milestones.mineInactive");

  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary, borderWidth: borders.width, borderColor: colors.border }}>
          <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.title, { color: colors.text }]}>{title}</Text>
          <Text style={[typography.meta, { color: colors.textMuted }]}>{t("community:stats.milestones.goal", { target: n(milestone.target) })}</Text>
        </View>
        {reached ? <MaterialCommunityIcons name="check-decagram" size={28} color={colors.success} accessibilityLabel={t("community:stats.milestones.reached")} /> : null}
      </View>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${title}: ${progressText}`}
        accessibilityValue={{ min: 0, max: milestone.target, now: Math.min(milestone.progress, milestone.target) }}
        style={{ height: 20, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
      >
        <View style={{ width: `${ratio * 100}%`, height: "100%", backgroundColor: reached ? colors.success : colors.secondary }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.xs }}>
        <Text style={[typography.label, { color: colors.text, fontVariant: ["tabular-nums"] }]}>
          {reached ? `${progressText} · ${t("community:stats.milestones.reached")}` : progressText}
        </Text>
        {milestone.streak > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <MaterialCommunityIcons name="fire" size={18} color={colors.danger} />
            <Text style={[typography.label, { color: colors.text }]}>{t("community:stats.milestones.streak", { count: milestone.streak })}</Text>
          </View>
        ) : null}
      </View>

      <View accessible accessibilityLabel={`${level}. ${t("community:stats.milestones.best", { target: n(milestone.bestTarget) })}`} style={{ gap: spacing.xxs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {ladderDots(milestone.rung, milestone.rungs).map((state, i) => (
            <View
              key={i}
              style={{
                width: state === "current" ? 18 : 12,
                height: state === "current" ? 18 : 12,
                borderWidth: borders.width,
                borderColor: colors.border,
                backgroundColor: state === "past" ? colors.primary : state === "current" ? colors.secondary : colors.surface,
              }}
            />
          ))}
          <Text style={[typography.caption, { color: colors.textMuted, marginLeft: spacing.xs }]}>{level}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{t("community:stats.milestones.best", { target: n(milestone.bestTarget) })}</Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.sm, backgroundColor: colors.surfaceAlt }}>
        <MaterialCommunityIcons name="account-heart-outline" size={20} color={colors.primary} />
        <Text style={[typography.meta, { color: colors.text, flex: 1 }]}>{mine}</Text>
      </View>
    </View>
  );
}

export default MilestoneCard;
