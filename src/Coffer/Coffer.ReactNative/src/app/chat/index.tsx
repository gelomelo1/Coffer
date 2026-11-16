import { Loading } from "@/src/components/custom_ui/loading";
import Composer from "@/src/components/market/chat/composer";
import MessageBubble from "@/src/components/market/chat/message_bubble";
import DealPanel from "@/src/components/market/deal/deal_panel";
import { EmptyState } from "@/src/components/market/ui/retro";
import { querykeys } from "@/src/const/querykeys";
import { useConversation, useDeal, useListing, useMessages, useMyDeals } from "@/src/hooks/market_api";
import { useKeyboardOverlapAtScreenBottom } from "@/src/hooks/keyboard_toolbar";
import { useMarketStore } from "@/src/hooks/market_store";
import { useUserStore } from "@/src/hooks/user_store";
import { colors, spacing } from "@/src/theme/theme";
import { marketApi } from "@/src/utils/market_api";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Buyer ↔ seller chat about one listing, with the deal panel pinned on top. */
function Chat() {
  const { t } = useTranslation();
  const { conversationId } = useMarketStore();
  const { user } = useUserStore();
  const queryClient = useQueryClient();
  const list = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  // The screen reaches the bottom edge; Android edge-to-edge windows don't resize for the keyboard, iOS never does.
  const keyboardOverlap = useKeyboardOverlapAtScreenBottom();
  const keyboardVisible = keyboardOverlap != null;

  const { data: conversation, isError } = useConversation(conversationId);
  const { data: messages = [] } = useMessages(conversationId);
  const { data: listing } = useListing(conversation?.subject.id);
  const { data: myDeals = [] } = useMyDeals();
  const latestDealId = myDeals.find((d) => d.conversationId === conversationId)?.id ?? conversation?.openDealId ?? null;
  const { data: deal } = useDeal(latestDealId);

  // For "searching for" posts the roles flip: whoever answers the post is the seller.
  const iAmSeller = !!conversation && (conversation.subject.kind === "wanted") === (conversation.myRole === "inquirer");

  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!conversationId || !lastMessageId) return;
    marketApi
      .markRead(conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: [querykeys.marketInbox] }))
      .catch(() => undefined);
    // New system messages usually mean the deal moved on: refresh it right away.
    queryClient.invalidateQueries({ queryKey: [querykeys.marketDeals] });
    queryClient.invalidateQueries({ queryKey: [querykeys.marketDeal] });
  }, [conversationId, lastMessageId, queryClient]);

  if (isError) return <EmptyState icon="chat-bubble-outline" title={t("market:chat.unavailable")} />;
  if (!conversation || !user) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: keyboardOverlap ?? 0 }}>
      <DealPanel compact={keyboardVisible} deal={deal} listing={listing} conversationId={conversation.id} iAmSeller={iAmSeller} />
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <EmptyState icon="chat-bubble-outline" title={t("market:chat.sayHi", { name: conversation.other.name })} text={t("market:chat.emptyText")} />
        }
        renderItem={({ item }) => <MessageBubble message={item} conversationId={conversation.id} myId={user.id} />}
      />
      <Composer conversationId={conversation.id} allowOffers={conversation.subject.kind !== "exchange"} bottomInset={keyboardVisible ? 0 : insets.bottom} />
    </View>
  );
}

export default Chat;
