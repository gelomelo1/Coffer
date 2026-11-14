import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useMarketStore } from "@/src/hooks/market_store";
import { navigate } from "expo-router/build/global-state/routing";

/** Opens the chat screen for a conversation. */
export function openChat(conversationId: string, otherUserName: string, listingTitle: string) {
  useMarketStore.getState().setConversationId(conversationId);
  navigate({ pathname: ROUTES.CHAT, params: pageParams.chat(otherUserName, listingTitle) });
}
