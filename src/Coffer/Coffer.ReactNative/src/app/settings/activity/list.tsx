import { ActivityRow, CATEGORY_ICONS } from "@/src/components/activity/activity_row";
import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { Loading } from "@/src/components/custom_ui/loading";
import { EmptyState, ErrorState } from "@/src/components/custom_ui/states";
import { useActivity, useActivityListStore } from "@/src/hooks/activity";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { groupByDay } from "@/src/utils/activity_format";
import { apiErrorText } from "@/src/utils/api_error_text";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshControl, SectionList, Text, View } from "react-native";

/** One kind of activity (or all of it), newest first, in day sections; 20 entries at a time. */
function ActivityList() {
  const { t, i18n } = useTranslation();
  const category = useActivityListStore((s) => s.category);
  const { items, isLoading, isError, error, refetch, refreshing, onRefresh, loadMore, isFetchingNextPage } = useActivity(category);

  const sections = useMemo(
    () =>
      groupByDay(items, new Date(), {
        today: t("activity:today"),
        yesterday: t("activity:yesterday"),
        date: (d) => d.toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "short" }),
      }),
    [items, t, i18n.language],
  );

  return (
    <SectionList
      style={{ flex: 1, backgroundColor: colors.bg }}
      sections={sections}
      keyExtractor={(e) => e.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={<ListFooterLoading loading={isFetchingNextPage} />}
      ListEmptyComponent={
        isLoading ? (
          <Loading />
        ) : isError ? (
          <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />
        ) : (
          <EmptyState
            icon={category ? CATEGORY_ICONS[category] : "history"}
            title={t("activity:emptyTitle")}
            text={t(`activity:empty.${category ?? "all"}`)}
          />
        )
      }
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[typography.label, { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.xs }]}>
          {section.title}
        </Text>
      )}
      renderItem={({ item, index, section }) => (
        <View
          style={{
            borderWidth: borders.width,
            borderColor: colors.border,
            borderTopWidth: index === 0 ? borders.width : 0,
            borderBottomWidth: index === section.data.length - 1 ? borders.width : 0,
          }}
        >
          {index > 0 ? <View style={{ height: borders.hairline, backgroundColor: colors.borderMuted }} /> : null}
          <ActivityRow entry={item} />
        </View>
      )}
    />
  );
}

export default ActivityList;
