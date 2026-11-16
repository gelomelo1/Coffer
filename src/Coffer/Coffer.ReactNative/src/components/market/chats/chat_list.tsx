import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { useInbox } from "@/src/hooks/market_api";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { apiErrorText } from "@/src/utils/api_error_text";
import { formatTimeAgo } from "@/src/utils/market_api";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { EmptyState, ListingImageView, Tag } from "../ui/retro";
import { openChat } from "./open_chat";

/** CHATS tab: all my listing conversations, newest first, with unread counters. */
function ChatList() {
  const { t } = useTranslation();
  const { data = [], isFetching, isError, error, refetch } = useInbox();

  return (
    <FlatList
      data={data}
      keyExtractor={(x) => x.id}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl * 2 }}
      refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[colors.primary]} tintColor={colors.primary} />}
      ListEmptyComponent={
        isFetching ? (
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
        const preview = item.lastMessagePreview ?? t("market:details.noPreview");
        return (
          <Pressable
            onPress={() => openChat(item.id, item.other.name, item.subject.title)}
            accessibilityRole="button"
            accessibilityLabel={[role, item.subject.title, item.other.name, preview, unread ? t("market:tabs.badge", { count: item.unreadCount }) : null]
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
                {item.subject.title}
              </Text>
              <Text style={[unread ? typography.label : typography.meta, { color: colors.text }]} numberOfLines={1}>
                {t("market:chats.preview", { name: item.other.name, text: preview })}
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
