import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { openListing } from "@/src/components/market/browse/listing_card";
import { openChat } from "@/src/components/market/chats/open_chat";
import { EmptyState, SectionCard, Tag } from "@/src/components/market/ui/retro";
import { querykeys } from "@/src/const/querykeys";
import { useAgainstMe, useAgainstMeUnseen, useMyReports, useReportRules } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { ModerationActionItem, MyReport, ReportTargetType } from "@/src/types/entities/market";
import { formatDateTime, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FlatList, RefreshControl, TouchableOpacity, View } from "react-native";

const c = customTheme.colors;

const targetLabels: Record<ReportTargetType, string> = { listing: "Listing", message: "Chat message", review: "Review" };

/** Opens what a report / moderation notice is about: the listing, or the chat the message or review belongs to. */
function openTarget(item: { targetType: ReportTargetType; listingId?: string | null; conversationId?: string | null }, summary: string) {
  if (item.targetType === "listing" && item.listingId) openListing(item.listingId, summary);
  else if (item.conversationId) openChat(item.conversationId, "Chat", summary);
}

function OpenLink({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
      <MaterialIcons name="open-in-new" size={16} color={c.primary} />
      <CustomText style={{ textDecorationLine: "underline", fontSize: 14 }}>{label}</CustomText>
    </TouchableOpacity>
  );
}

function MyReportCard({ report, ruleLabel }: { report: MyReport; ruleLabel: string }) {
  const outcome =
    report.status === "open"
      ? { label: "Waiting for review", color: c.secondary }
      : report.decision === "removed"
        ? { label: "Content removed", color: "green" }
        : { label: "No rule break found", color: c.accent };
  return (
    <SectionCard>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <Tag label={targetLabels[report.targetType]} color={c.primary} />
        <Tag label={outcome.label} color={outcome.color} />
      </View>
      <CustomText style={{ fontFamily: "VendSansBold" }} numberOfLines={2}>
        {report.targetSummary}
      </CustomText>
      <CustomText style={{ fontSize: 14 }}>Rule: {ruleLabel}</CustomText>
      <CustomText style={{ fontSize: 14 }}>Your reason: {report.reason}</CustomText>
      {report.statement ? <CustomText style={{ fontSize: 14 }}>Decision: {report.statement}</CustomText> : null}
      <CustomText style={{ fontSize: 12 }}>
        Reported {formatDateTime(report.createdAt)}
        {report.resolvedAt ? ` · decided ${formatDateTime(report.resolvedAt)}` : ""}
      </CustomText>
      <OpenLink onPress={() => openTarget(report, report.targetSummary)} label="Open what I reported" />
    </SectionCard>
  );
}

function ActionCard({ action }: { action: ModerationActionItem }) {
  return (
    <SectionCard accent="red">
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        <Tag label={`${targetLabels[action.targetType]} removed`} color="red" />
        {!action.seen ? <Tag label="New" color={c.secondary} textColor={c.primary} /> : null}
      </View>
      <CustomText style={{ fontFamily: "VendSansBold" }}>Rule: {action.ruleLabel}</CustomText>
      <CustomText style={{ fontSize: 14 }}>Why: {action.statement}</CustomText>
      <CustomText style={{ fontSize: 13, fontStyle: "italic" }} numberOfLines={3}>
        “{action.contentExcerpt}”
      </CustomText>
      <CustomText style={{ fontSize: 12 }}>{formatDateTime(action.createdAt)}</CustomText>
      <OpenLink onPress={() => openTarget(action, action.contentExcerpt)} label="Open" />
    </SectionCard>
  );
}

/** Settings › Reports: what I reported (with the outcome), and moderation decisions about my own content. */
function Reports() {
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

  const ruleLabel = (rule: string) => rules.find((r) => r.rule === rule)?.label ?? rule;
  const tabs = [
    { title: "MY REPORTS", badge: 0 },
    { title: "ABOUT MY CONTENT", badge: unseen },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flexDirection: "row", justifyContent: "center", borderBottomWidth: 2, borderColor: c.primary }}>
        {tabs.map((t, i) => (
          <TouchableOpacity
            key={t.title}
            onPress={() => setTab(i)}
            style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: tab === i ? 3 : 0, borderBottomColor: c.secondary, flexDirection: "row", gap: 4 }}
          >
            <CustomText style={{ fontFamily: "VendSansBold", color: tab === i ? c.secondary : c.primary, fontSize: 14 }}>{t.title}</CustomText>
            {t.badge > 0 ? (
              <View style={{ backgroundColor: "red", paddingHorizontal: 5 }}>
                <CustomText style={{ color: c.background, fontSize: 11, fontFamily: "VendSansBold" }}>{t.badge}</CustomText>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 0 ? (
        <FlatList
          data={mine.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 10 }}
          refreshControl={<RefreshControl refreshing={mine.isFetching} onRefresh={mine.refetch} />}
          ListHeaderComponent={
            <CustomText style={{ fontSize: 13, marginBottom: 8 }}>
              Reports are checked against the marketplace rules only. Coffer doesn&apos;t decide who was right in a deal.
            </CustomText>
          }
          ListEmptyComponent={mine.isFetching ? <Loading /> : <EmptyState icon="flag" title="You haven't reported anything" />}
          renderItem={({ item }) => <MyReportCard report={item} ruleLabel={ruleLabel(item.rule)} />}
        />
      ) : (
        <FlatList
          data={against.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 10 }}
          refreshControl={<RefreshControl refreshing={against.isFetching} onRefresh={against.refetch} />}
          ListHeaderComponent={
            <CustomText style={{ fontSize: 13, marginBottom: 8 }}>
              When something you posted is removed for breaking a rule, you see here what and why. Who reported it is
              never shown.
            </CustomText>
          }
          ListEmptyComponent={
            against.isFetching ? <Loading /> : <EmptyState icon="verified-user" title="Nothing of yours was removed" />
          }
          renderItem={({ item }) => <ActionCard action={item} />}
        />
      )}
    </View>
  );
}

export default Reports;
