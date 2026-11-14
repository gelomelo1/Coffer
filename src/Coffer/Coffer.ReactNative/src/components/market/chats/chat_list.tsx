import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import { useInbox } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { formatTimeAgo } from "@/src/utils/market_api";
import { FlatList, RefreshControl, TouchableOpacity, View } from "react-native";
import { EmptyState, ListingImageView, Tag } from "../ui/retro";
import { openChat } from "./open_chat";

const c = customTheme.colors;

/** CHATS tab: all my listing conversations, newest first, with unread counters. */
function ChatList() {
  const { data = [], isFetching, refetch } = useInbox();

  return (
    <FlatList
      data={data}
      keyExtractor={(x) => x.id}
      contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
      ListEmptyComponent={
        isFetching ? <Loading /> : <EmptyState icon="chat-bubble-outline" title="No chats yet" text="Open a listing and message the seller." />
      }
      renderItem={({ item }) => {
        const selling = (item.subject.kind === "wanted") === (item.myRole === "inquirer");
        return (
          <TouchableOpacity
            onPress={() => openChat(item.id, item.other.name, item.subject.title)}
            style={{
              flexDirection: "row",
              gap: 10,
              alignItems: "center",
              borderWidth: 2,
              borderColor: c.primary,
              backgroundColor: item.unreadCount > 0 ? `${c.secondary}55` : c.background,
              boxShadow: `2px 2px ${c.primary}`,
              padding: 8,
              marginBottom: 10,
            }}
          >
            <ListingImageView fileName={item.subject.image} style={{ width: 54, height: 54 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Tag label={selling ? "Selling" : "Buying"} color={selling ? c.secondary : c.primary} />
                <CustomText style={{ fontSize: 11 }}>{formatTimeAgo(item.lastMessageAt)}</CustomText>
              </View>
              <CustomText style={{ fontFamily: "VendSansBold" }} numberOfLines={1}>
                {item.subject.title}
              </CustomText>
              <CustomText style={{ fontSize: 14 }} numberOfLines={1}>
                {item.other.name}: {item.lastMessagePreview ?? "—"}
              </CustomText>
            </View>
            {item.unreadCount > 0 ? <Tag label={String(item.unreadCount)} color="red" /> : null}
          </TouchableOpacity>
        );
      }}
    />
  );
}

export default ChatList;
