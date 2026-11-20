import { SectionCard } from "@/src/components/custom_ui/card";
import { ConfirmDialog } from "@/src/components/custom_ui/confirm_dialog";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { openChat } from "@/src/components/market/chats/open_chat";
import { dealStatusLabels } from "@/src/const/market";
import { useMarketMutation } from "@/src/hooks/market_api";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { BlockingDeal } from "@/src/types/entities/market";
import { listingLabel, userLabel } from "@/src/utils/deleted_labels";
import { formatDate, marketApi } from "@/src/utils/market_api";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

interface BlockingTradesProps {
  deals: BlockingDeal[];
  /** Called after a trade was cancelled, so the deletion status reloads. */
  onChanged: () => void;
}

/** The open trades that keep the account from being deleted: cancel the ones not shipped yet, wait for the rest. */
function BlockingTrades({ deals, onChanged }: BlockingTradesProps) {
  const { t } = useTranslation();
  const [cancelling, setCancelling] = useState<BlockingDeal | null>(null);
  const cancel = useMarketMutation((id: string) => marketApi.cancelDeal(id, t("settings:deleteAccount.cancelReason")));

  const confirmCancel = () => {
    if (!cancelling) return;
    cancel.mutate(cancelling.dealId, {
      onSettled: () => {
        setCancelling(null);
        onChanged();
      },
    });
  };

  return (
    <SectionCard title={t("settings:deleteAccount.tradesTitle")} accent={colors.danger}>
      <Text style={[typography.body, { color: colors.text }]}>{t("settings:deleteAccount.tradesText")}</Text>
      {deals.map((deal) => {
        const title = listingLabel(deal.listingTitle, false, t);
        const other = userLabel(deal.other, t);
        return (
          <View key={deal.dealId} style={{ borderTopWidth: borders.hairline, borderColor: colors.borderMuted, paddingTop: spacing.sm, gap: spacing.xs }}>
            <Pressable onPress={() => openChat(deal.conversationId, other, title)} accessibilityRole="button" accessibilityLabel={`${title}, ${dealStatusLabels[deal.status]}`}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{title}</Text>
              <Text style={[typography.meta, { color: colors.textMuted }]}>
                {[t("settings:deleteAccount.with", { name: other }), dealStatusLabels[deal.status]].join(" · ") /* i18n-ignore */}
              </Text>
            </Pressable>
            {deal.canCancel ? (
              <CustomButton title={t("settings:deleteAccount.cancel")} variant="outline" size="sm" onPress={() => setCancelling(deal)} />
            ) : deal.endsLatestAt ? (
              <Text style={[typography.meta, { color: colors.text }]}>{t("settings:deleteAccount.endsBy", { date: formatDate(deal.endsLatestAt) })}</Text>
            ) : null}
          </View>
        );
      })}

      <ConfirmDialog
        isVisible={cancelling !== null}
        title={t("settings:deleteAccount.cancelTitle")}
        message={t("settings:deleteAccount.cancelText")}
        confirmLabel={t("settings:deleteAccount.cancel")}
        destructive
        loading={cancel.isPending}
        onCancel={() => setCancelling(null)}
        onConfirm={confirmCancel}
      />
    </SectionCard>
  );
}

export default BlockingTrades;
