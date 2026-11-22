import { GrowthChart } from "@/src/components/community/growth_chart";
import { CollectorOfTheWeek, TrendingType } from "@/src/components/community/highlight_card";
import { MilestoneCard } from "@/src/components/community/milestone_card";
import { StatCard } from "@/src/components/community/stat_card";
import { SectionHeader } from "@/src/components/custom_ui/card";
import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { useCommunityStats } from "@/src/hooks/community";
import { colors, spacing, typography } from "@/src/theme/theme";
import { apiErrorText } from "@/src/utils/api_error_text";
import { formatTimeAgo } from "@/src/utils/market_api";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, ScrollView, Text, View } from "react-native";

/** Stats & facts: the community in numbers, its growth, this week's highlights and the weekly milestones. */
function Stats() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useCommunityStats();
  const [refreshing, setRefreshing] = useState(false);

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };
  const n = (v: number) => v.toLocaleString(i18n.language);
  const items = data.milestones.find((m) => m.key === "itemsAdded");
  const active = data.milestones.find((m) => m.key === "activeUsers");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
    >
      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t("community:stats.numbers")} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <StatCard icon="account-group" label={t("community:stats.totals.members")} value={data.totals.members} accent />
          <StatCard
            icon="bottle-tonic-outline"
            label={t("community:stats.totals.items")}
            value={data.totals.items}
            sub={t("community:stats.totals.pieces", { count: data.totals.pieces, formatted: n(data.totals.pieces) })}
          />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <StatCard icon="treasure-chest" label={t("community:stats.totals.collections")} value={data.totals.collections} />
          <StatCard
            icon="heart-multiple-outline"
            label={t("community:stats.totals.interactions")}
            value={data.totals.interactions}
            sub={t("community:stats.totals.recent", { week: n(data.interactions.thisWeek), month: n(data.interactions.thisMonth) })}
          />
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t("community:stats.growth.title")} />
        <GrowthChart growth={data.growth} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t("community:stats.highlights.title")} />
        <View style={{ flexDirection: "row", gap: spacing.sm, paddingRight: 3, paddingBottom: 3 }}>
          <CollectorOfTheWeek collector={data.topCollector} />
          <TrendingType type={data.trendingType} />
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t("community:stats.milestones.title")} />
        <Text style={[typography.body, { color: colors.text }]}>{t("community:stats.milestones.intro")}</Text>
        {items ? <MilestoneCard milestone={items} icon="package-variant-plus" /> : null}
        {active ? <MilestoneCard milestone={active} icon="account-multiple-check-outline" /> : null}
      </View>

      <Text style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>
        {t("community:stats.updated", { when: formatTimeAgo(data.generatedAt) })}
      </Text>
    </ScrollView>
  );
}

export default Stats;
