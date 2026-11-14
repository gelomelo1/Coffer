import CustomText from "@/src/components/custom_ui/custom_text";
import { useMarketMutation } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { Message } from "@/src/types/entities/market";
import { formatDateTime, formatPrice, marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import ReportOverlay from "../ui/report_overlay";
import { Chip, ChipRow, Tag } from "../ui/retro";

const c = customTheme.colors;

const statusTag = {
  pending: { label: "Waiting for answer", color: c.secondary },
  accepted: { label: "Accepted", color: "green" },
  declined: { label: "Declined", color: "red" },
  withdrawn: { label: "Withdrawn", color: c.accent },
} as const;

function MessageBubble({ message, conversationId, myId }: { message: Message; conversationId: string; myId: string }) {
  const [reportOpen, setReportOpen] = useState(false);
  const respond = useMarketMutation(
    (action: "accept" | "decline" | "withdraw") => marketApi.respond(conversationId, message.id, action),
  );

  if (message.kind === "system") {
    return (
      <View style={{ alignSelf: "center", maxWidth: "92%", marginVertical: 6, padding: 6, borderWidth: 1, borderStyle: "dashed", borderColor: c.primary }}>
        <CustomText style={{ fontSize: 13, textAlign: "center", fontStyle: "italic" }}>{message.body}</CustomText>
        <CustomText style={{ fontSize: 10, textAlign: "center" }}>{formatDateTime(message.createdAt)}</CustomText>
      </View>
    );
  }

  const mine = message.senderId === myId;

  if (message.isRemoved) {
    return (
      <View style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", marginVertical: 4, padding: 8, borderWidth: 1, borderStyle: "dashed", borderColor: c.accent }}>
        <CustomText style={{ fontStyle: "italic", fontSize: 13, color: c.accent }}>{message.body}</CustomText>
      </View>
    );
  }

  const isProposal = message.kind === "price_offer" || message.kind === "meetup_proposal";
  const pending = message.status === "pending";

  return (
    <Pressable
      // Long-press someone else's message to report it against the content rules.
      onLongPress={mine ? undefined : () => setReportOpen(true)}
      delayLongPress={400}
      accessibilityHint={mine ? undefined : "Long-press to report this message"}
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "82%",
        marginVertical: 4,
        padding: 8,
        borderWidth: 2,
        borderColor: c.primary,
        backgroundColor: mine ? c.secondary : c.background,
        boxShadow: `2px 2px ${c.primary}`,
        gap: 4,
      }}
    >
      {message.kind === "price_offer" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialIcons name="euro" size={20} color={c.primary} />
          <CustomText style={{ fontFamily: "VendSansBold", fontSize: 18 }}>Offer: {formatPrice(message.amountCents)}</CustomText>
        </View>
      ) : null}
      {message.kind === "meetup_proposal" ? (
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MaterialIcons name="event" size={20} color={c.primary} />
            <CustomText style={{ fontFamily: "VendSansBold" }}>Meetup: {formatDateTime(message.at)}</CustomText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MaterialIcons name="place" size={20} color={c.primary} />
            <CustomText>{message.place}</CustomText>
          </View>
        </View>
      ) : null}
      {message.body ? <CustomText>{message.body}</CustomText> : null}
      {isProposal && message.status ? <Tag label={statusTag[message.status].label} color={statusTag[message.status].color} /> : null}
      {isProposal && pending ? (
        <ChipRow>
          {mine ? (
            <Chip label="Withdraw" disabled={respond.isPending} onPress={() => respond.mutate("withdraw")} />
          ) : (
            <>
              <Chip label="Accept" disabled={respond.isPending} onPress={() => respond.mutate("accept")} />
              <Chip label="Decline" disabled={respond.isPending} onPress={() => respond.mutate("decline")} />
            </>
          )}
        </ChipRow>
      ) : null}
      <CustomText style={{ fontSize: 10, alignSelf: "flex-end" }}>{formatDateTime(message.createdAt)}</CustomText>
      {!mine ? (
        <ReportOverlay isVisible={reportOpen} onClose={() => setReportOpen(false)} targetType="message" targetId={message.id} />
      ) : null}
    </Pressable>
  );
}

export default MessageBubble;
