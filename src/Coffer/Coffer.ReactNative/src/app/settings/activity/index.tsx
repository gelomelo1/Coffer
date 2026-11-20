import { CATEGORY_ICONS } from "@/src/components/activity/activity_row";
import { SectionHeader } from "@/src/components/custom_ui/card";
import { ListRow } from "@/src/components/custom_ui/list_row";
import { Loading } from "@/src/components/custom_ui/loading";
import { Screen } from "@/src/components/custom_ui/screen";
import { ErrorState } from "@/src/components/custom_ui/states";
import { openActivityList, useActivitySummary } from "@/src/hooks/activity";
import { borders, colors, sizes, typography } from "@/src/theme/theme";
import { ACTIVITY_CATEGORIES } from "@/src/types/entities/activity";
import { apiErrorText } from "@/src/utils/api_error_text";
import { formatTimeAgo } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

/** My activity: "All activity" on top, then one row per kind of activity with its count and latest time. */
function ActivityMenu() {
  const { t } = useTranslation();
  const { data: summary = [], isLoading, isError, error, refetch } = useActivitySummary();

  // Coming back from an entry (where something may have changed): fresh counts.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;

  const total = summary.reduce((sum, s) => sum + s.count, 0);
  const latest = summary.map((s) => s.latestAt).filter((x): x is string => !!x).sort().pop() ?? null;
  const subtitle = (count: number, at: string | null) =>
    count === 0 ? t("activity:nothingYet") : `${t("activity:count", { count })} · ${t("activity:last", { when: formatTimeAgo(at) })}`; // i18n-ignore (separator)

  return (
    <Screen scroll>
      <Text style={[typography.body, { color: colors.text }]}>{t("activity:intro")}</Text>
      <View style={{ borderWidth: borders.width, borderColor: colors.border }}>
        <ListRow
          title={t("activity:all")}
          subtitle={subtitle(total, latest)}
          leading={<MaterialIcons name="history" size={sizes.iconMd} color={colors.text} />}
          onPress={() => openActivityList(null)}
        />
      </View>
      <View>
        <SectionHeader title={t("activity:byKind")} />
        <View style={{ borderWidth: borders.width, borderColor: colors.border }}>
          {ACTIVITY_CATEGORIES.map((category, i) => {
            const s = summary.find((x) => x.category === category);
            return (
              <ListRow
                key={category}
                style={i === 0 ? undefined : { borderTopWidth: borders.hairline, borderColor: colors.borderMuted }}
                title={t(`activity:categories.${category}`)}
                subtitle={subtitle(s?.count ?? 0, s?.latestAt ?? null)}
                leading={<MaterialIcons name={CATEGORY_ICONS[category]} size={sizes.iconMd} color={colors.text} />}
                onPress={() => openActivityList(category)}
              />
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

export default ActivityMenu;
