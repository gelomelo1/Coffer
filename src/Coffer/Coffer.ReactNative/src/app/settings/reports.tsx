import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { openItem } from "@/src/components/comments/open_item";
import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { openListing } from "@/src/components/market/browse/listing_card";
import { openChat } from "@/src/components/market/chats/open_chat";
import { EmptyState, SectionCard, Tag } from "@/src/components/market/ui/retro";
import { querykeys } from "@/src/const/querykeys";
import { reportRuleText } from "@/src/const/market";
import { useAgainstMe, useAgainstMeUnseen, useMyReports, useReportRules } from "@/src/hooks/market_api";
import i18n from "@/src/i18n";
import { borders, colors, fonts, sizes, spacing, typography } from "@/src/theme/theme";
import { ModerationActionItem, MyReport, ReportRule, ReportTargetType } from "@/src/types/entities/market";
import { apiErrorText } from "@/src/utils/api_error_text";
import { formatDateTime, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

type Target = { targetType: ReportTargetType; listingId?: string | null; conversationId?: string | null; itemId?: string | null };

/** Opens what a report / moderation notice is about: the listing, the chat of a message or review, or the item of a comment. */
function openTarget(item: Target, summary: string) {
  if (item.targetType === "listing" && item.listingId) openListing(item.listingId, summary);
  else if ((item.targetType === "item" || item.targetType === "comment") && item.itemId) openItem(item.itemId);
  else if (item.conversationId) openChat(item.conversationId, i18n.t("settings:reports.chat"), summary);
}

/** Removed collection items no longer exist, so there is nothing to open. */
const canOpen = (item: Target) => !!(item.listingId || item.conversationId || item.itemId);

function OpenLink({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.xxs, alignSelf: "flex-start", minHeight: sizes.touch, opacity: pressed ? 0.6 : 1 })}
    >
      <MaterialIcons name="open-in-new" size={sizes.iconSm} color={colors.text} />
      <Text style={[typography.label, { color: colors.text, textDecorationLine: "underline" }]}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Text style={[typography.meta, { color: colors.text }]}>
      <Text style={{ fontFamily: fonts.bold }}>{label}: </Text>
      {value}
    </Text>
  );
}

function MyReportCard({ report, ruleLabel }: { report: MyReport; ruleLabel: string }) {
  const { t } = useTranslation();
  const outcome =
    report.status === "open"
      ? { key: "waiting", color: colors.secondary }
      : report.decision === "removed"
        ? { key: "removed", color: colors.success }
        : report.decision === "suspended"
          ? { key: "suspended", color: colors.success }
          : { key: "noViolation", color: colors.accent };
  return (
    <SectionCard>
      <View style={{ flexDirection: "row", gap: spacing.xxs, flexWrap: "wrap" }}>
        <Tag label={t(`settings:reports.target.${report.targetType}`)} color={colors.primary} />
        <Tag label={t(`settings:reports.outcome.${outcome.key}`)} color={outcome.color} />
      </View>
      <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={2}>
        {report.targetSummary}
      </Text>
      <Field label={t("settings:reports.rule")} value={ruleLabel} />
      <Field label={t("settings:reports.yourReason")} value={report.reason} />
      {report.statement ? <Field label={t("settings:reports.decision")} value={report.statement} /> : null}
      <Text style={[typography.caption, { color: colors.textMuted }]}>
        {report.resolvedAt
          ? t("settings:reports.reportedDecided", { reported: formatDateTime(report.createdAt), decided: formatDateTime(report.resolvedAt) })
          : t("settings:reports.reported", { reported: formatDateTime(report.createdAt) })}
      </Text>
      {canOpen(report) ? <OpenLink onPress={() => openTarget(report, report.targetSummary)} label={t("settings:reports.openReported")} /> : null}
    </SectionCard>
  );
}

function ActionCard({ action }: { action: ModerationActionItem }) {
  const { t } = useTranslation();
  return (
    <SectionCard accent={colors.danger}>
      <View style={{ flexDirection: "row", gap: spacing.xxs, flexWrap: "wrap" }}>
        <Tag label={t("settings:reports.moderated", { target: t(`settings:reports.target.${action.targetType}`) })} color={colors.danger} />
        {!action.seen ? <Tag label={t("settings:reports.new")} color={colors.secondary} /> : null}
      </View>
      <Field label={t("settings:reports.rule")} value={reportRuleText(action.rule, "label", action.ruleLabel)} />
      <Field label={t("settings:reports.why")} value={action.statement} />
      <Text style={[typography.meta, { color: colors.textMuted, fontStyle: "italic" }]} numberOfLines={3}>
        {t("settings:reports.excerpt", { text: action.contentExcerpt })}
      </Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDateTime(action.createdAt)}</Text>
      {canOpen(action) ? <OpenLink onPress={() => openTarget(action, action.contentExcerpt)} label={t("settings:reports.open")} /> : null}
    </SectionCard>
  );
}

/** Settings › Reports: what I reported (with the outcome), and moderation decisions about my own content. */
function Reports() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const queryClient = useQueryClient();
  const { data: rules = [] } = useReportRules();
  const mine = useMyReports();
  const against = useAgainstMe();
  const { data: unseen = 0 } = useAgainstMeUnseen();

  useEffect(() => {
    if (tab === 1 && unseen > 0) {
      marketApi
        .markAgainstMeSeen()
        .then(() => queryClient.invalidateQueries({ queryKey: [querykeys.againstMeUnseen] }))
        .catch(() => undefined);
    }
  }, [tab, unseen, queryClient]);

  const ruleLabel = (rule: ReportRule) => reportRuleText(rule, "label", rules.find((r) => r.rule === rule)?.label ?? rule);
  const tabs = [
    { title: t("settings:reports.tabMine"), badge: 0 },
    { title: t("settings:reports.tabAboutMe"), badge: unseen },
  ];
  const listStyle = { padding: spacing.md, paddingBottom: spacing.xxl };
  const intro = (text: string) => <Text style={[typography.meta, { color: colors.text, marginBottom: spacing.md }]}>{text}</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", borderBottomWidth: borders.width, borderColor: colors.border }}>
        {tabs.map((item, i) => {
          const active = tab === i;
          return (
            <Pressable
              key={item.title}
              onPress={() => setTab(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.badge > 0 ? `${item.title}, ${t("settings:index.newCount", { count: item.badge })}` : item.title}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 52,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xxs,
                alignItems: "center",
                alignContent: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.xs,
                backgroundColor: active ? colors.secondary : pressed ? colors.surfaceAlt : colors.bg,
                borderLeftWidth: i === 0 ? 0 : borders.hairline,
                borderLeftColor: colors.borderMuted,
              })}
            >
              <Text style={{ color: colors.text, fontFamily: active ? fonts.bold : fonts.regular, fontSize: 15, textAlign: "center" }}>{item.title}</Text>
              {item.badge > 0 ? (
                <View style={{ backgroundColor: colors.danger, minWidth: 20, paddingHorizontal: 4, alignItems: "center" }}>
                  <Text style={{ color: colors.onPrimary, fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 }}>{item.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {tab === 0 ? (
        <FlatList
          data={mine.items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={listStyle}
          refreshControl={<RefreshControl refreshing={mine.refreshing} onRefresh={mine.onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          onEndReached={mine.loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={<ListFooterLoading loading={mine.isFetchingNextPage} />}
          ListHeaderComponent={intro(t("settings:reports.introMine"))}
          ListEmptyComponent={
            mine.isLoading ? (
              <Loading />
            ) : mine.isError ? (
              <ErrorState message={apiErrorText(mine.error)} onRetry={() => mine.refetch()} />
            ) : (
              <EmptyState icon="flag" title={t("settings:reports.emptyMine")} />
            )
          }
          renderItem={({ item }) => <MyReportCard report={item} ruleLabel={ruleLabel(item.rule)} />}
        />
      ) : (
        <FlatList
          data={against.items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={listStyle}
          refreshControl={<RefreshControl refreshing={against.refreshing} onRefresh={against.onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          onEndReached={against.loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={<ListFooterLoading loading={against.isFetchingNextPage} />}
          ListHeaderComponent={intro(t("settings:reports.introAboutMe"))}
          ListEmptyComponent={
            against.isLoading ? (
              <Loading />
            ) : against.isError ? (
              <ErrorState message={apiErrorText(against.error)} onRetry={() => against.refetch()} />
            ) : (
              <EmptyState icon="verified-user" title={t("settings:reports.emptyAboutMe")} />
            )
          }
          renderItem={({ item }) => <ActionCard action={item} />}
        />
      )}
    </View>
  );
}

export default Reports;
