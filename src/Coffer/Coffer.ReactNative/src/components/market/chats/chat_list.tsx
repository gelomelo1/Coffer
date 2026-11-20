import ListFooterLoading from "@/src/components/custom_ui/list_footer";
import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { useInbox } from "@/src/hooks/market_api";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { apiErrorText } from "@/src/utils/api_error_text";
import { chatPreview, formatTimeAgo } from "@/src/utils/market_api";
import { listingLabel, userLabel } from "@/src/utils/deleted_labels";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { EmptyState, ListingImageView, Tag } from "../ui/retro";
import { openChat } from "./open_chat";

/** CHATS tab: all my listing conversations, newest first, with unread counters. */
function ChatList() {
  const { t } = useTranslation();
  const { items: data, isLoading, isError, error, refetch, refreshing, onRefresh, loadMore, isFetchingNextPage } = useInbox();

  return (
    <FlatList
      data={data}
      keyExtractor={(x) => x.id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl * 2 }}
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
          <EmptyState icon="chat-bubble-outline" title={t("market:chats.emptyTitle")} text={t("market:chats.emptyText")} />
        )
      }
      renderItem={({ item }) => {
        const selling = (item.subject.kind === "wanted") === (item.myRole === "inquirer");
        const unread = item.unreadCount > 0;
        const role = selling ? t("market:chats.selling") : t("market:chats.buying");
        const preview = item.lastMessage ? chatPreview(item.lastMessage) : (item.lastMessagePreview ?? t("market:details.noPreview"));
        // System messages are nobody's words: no name in front of them.
        const sender = item.lastMessage?.senderId;
        const previewLine = !item.lastMessage
          ? t("market:chats.preview", { name: userLabel(item.other, t), text: preview })
          : sender == null
            ? preview
            : sender === item.other.id
              ? t("market:chats.preview", { name: userLabel(item.other, t), text: preview })
              : t("market:chats.previewMine", { text: preview });
        return (
          <Pressable
            onPress={() => openChat(item.id, userLabel(item.other, t), listingLabel(item.subject.title, item.subject.isDeleted, t))}
            accessibilityRole="button"
            accessibilityLabel={[role, listingLabel(item.subject.title, item.subject.isDeleted, t), userLabel(item.other, t), preview, unread ? t("market:tabs.badge", { count: item.unreadCount }) : null]
              .filter(Boolean)
              .join(", ")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                gap: spacing.sm,
                alignItems: "center",
                borderWidth: borders.width,
                borderColor: colors.border,
                borderLeftWidth: unread ? 6 : borders.width,
                borderLeftColor: unread ? colors.secondary : colors.border,
                backgroundColor: colors.surface,
                padding: spacing.sm,
              },
              pressableShadowStyle(pressed),
            ]}
          >
            <ListingImageView fileName={item.subject.image} style={{ width: 56, height: 56 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
                <Tag label={role} color={selling ? colors.secondary : colors.primary} textColor={selling ? colors.onSecondary : colors.onPrimary} />
                <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>
                  {formatTimeAgo(item.lastMessageAt)}
                </Text>
              </View>
              <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                {listingLabel(item.subject.title, item.subject.isDeleted, t)}
              </Text>
              <Text style={[unread ? typography.label : typography.meta, { color: colors.text }]} numberOfLines={1}>
                {previewLine}
              </Text>
            </View>
            {unread ? <Tag label={String(item.unreadCount)} color={colors.danger} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

export default ChatList;
