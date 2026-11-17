import { useMarketMutation } from "@/src/hooks/market_api";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Message } from "@/src/types/entities/market";
import { chatMessageText, formatDateTime, formatPrice, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import ReportOverlay from "../ui/report_overlay";
import { Chip, ChipRow, Tag } from "../ui/retro";

const statusColor = {
  pending: colors.secondary,
  accepted: colors.success,
  declined: colors.danger,
  withdrawn: colors.accent,
} as const;

/**
 * One chat message. System messages arrive as a code + params and are shown in the app language.
 * Someone else's message can be reported with a long press or the screen reader's action menu.
 */
function MessageBubble({ message, conversationId, myId }: { message: Message; conversationId: string; myId: string }) {
  const { t } = useTranslation();
  const [reportOpen, setReportOpen] = useState(false);
  const respond = useMarketMutation((action: "accept" | "decline" | "withdraw") => marketApi.respond(conversationId, message.id, action));

  if (message.kind === "system") {
    return (
      <View
        accessible
        style={{
          alignSelf: "center",
          maxWidth: "92%",
          marginVertical: spacing.xs,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          borderWidth: borders.hairline,
          borderStyle: "dashed",
          borderColor: colors.border,
          gap: 2,
        }}
      >
        <Text style={[typography.meta, { color: colors.text, textAlign: "center", fontStyle: "italic" }]}>{chatMessageText(message)}</Text>
        <Text style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>{formatDateTime(message.createdAt)}</Text>
      </View>
    );
  }

  const mine = message.senderId === myId;
  const align = mine ? "flex-end" : "flex-start";

  if (message.isRemoved) {
    return (
      <View
        style={{
          alignSelf: align,
          maxWidth: "82%",
          marginVertical: spacing.xxs,
          padding: spacing.sm,
          borderWidth: borders.hairline,
          borderStyle: "dashed",
          borderColor: colors.accent,
        }}
      >
        <Text style={[typography.meta, { color: colors.textMuted, fontStyle: "italic" }]}>{chatMessageText(message)}</Text>
      </View>
    );
  }

  const isProposal = message.kind === "price_offer" || message.kind === "meetup_proposal";
  const pending = message.status === "pending";
  const canReport = !mine;

  return (
    <View style={{ alignSelf: align, maxWidth: "84%", marginVertical: spacing.xxs }}>
      <Pressable
        onLongPress={canReport ? () => setReportOpen(true) : undefined}
        delayLongPress={400}
        accessibilityHint={canReport ? t("market:chat.reportHint") : undefined}
        accessibilityActions={canReport ? [{ name: "longpress", label: t("market:chat.reportMessage") }] : undefined}
        onAccessibilityAction={canReport ? () => setReportOpen(true) : undefined}
        style={{
          padding: spacing.sm,
          borderWidth: borders.width,
          borderColor: colors.border,
          backgroundColor: mine ? colors.secondary : colors.surface,
          gap: spacing.xxs,
        }}
      >
        {message.kind === "price_offer" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <MaterialIcons name="euro" size={sizes.iconSm} color={colors.text} />
            <Text style={[typography.title, { color: colors.text, flexShrink: 1 }]}>
              {t("market:chat.offer", { price: formatPrice(message.amountCents) })}
            </Text>
          </View>
        ) : null}
        {message.kind === "meetup_proposal" ? (
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <MaterialIcons name="event" size={sizes.iconSm} color={colors.text} />
              <Text style={[typography.bodyStrong, { color: colors.text, flexShrink: 1 }]}>
                {t("market:chat.meetup", { time: formatDateTime(message.at) })}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <MaterialIcons name="place" size={sizes.iconSm} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, flexShrink: 1 }]}>{message.place}</Text>
            </View>
          </View>
        ) : null}
        {message.body ? <Text style={[typography.body, { color: colors.text }]}>{message.body}</Text> : null}
        {isProposal && message.status ? (
          <Tag
            label={t(`market:chat.status.${message.status}`)}
            color={statusColor[message.status]}
            textColor={message.status === "pending" ? colors.onSecondary : colors.onPrimary}
            style={{ alignSelf: "flex-start", borderWidth: mine ? borders.hairline : 0, borderColor: colors.border }}
          />
        ) : null}
        <Text style={[typography.caption, { color: colors.text, alignSelf: "flex-end" }]}>{formatDateTime(message.createdAt)}</Text>
      </Pressable>
      {isProposal && pending ? (
        <ChipRow style={{ marginTop: spacing.xs, justifyContent: align }}>
          {mine ? (
            <Chip label={t("market:chat.withdraw")} disabled={respond.isPending} onPress={() => respond.mutate("withdraw")} />
          ) : (
            <>
              <Chip
                label={t("market:chat.accept")}
                icon={<MaterialIcons name="check" size={18} color={colors.text} />}
                disabled={respond.isPending}
                onPress={() => respond.mutate("accept")}
              />
              <Chip
                label={t("market:chat.decline")}
                icon={<MaterialIcons name="close" size={18} color={colors.text} />}
                disabled={respond.isPending}
                onPress={() => respond.mutate("decline")}
              />
            </>
          )}
        </ChipRow>
      ) : null}
      {canReport ? <ReportOverlay isVisible={reportOpen} onClose={() => setReportOpen(false)} targetType="message" targetId={message.id} /> : null}
    </View>
  );
}

export default memo(MessageBubble);
