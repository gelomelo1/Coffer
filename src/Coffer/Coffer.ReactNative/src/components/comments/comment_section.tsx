import { Avatar } from "@/src/components/custom_ui/avatar";
import { SectionHeader } from "@/src/components/custom_ui/card";
import { ConfirmDialog } from "@/src/components/custom_ui/confirm_dialog";
import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import { Tag } from "@/src/components/custom_ui/tag";
import ReportOverlay from "@/src/components/market/ui/report_overlay";
import { commentApi, useCommentMutation, useItemComments } from "@/src/hooks/comment_api";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { ItemComment } from "@/src/types/entities/comment";
import { apiErrorText } from "@/src/utils/api_error_text";
import { formatTimeAgo } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useRef, useState } from "react";
import { useCommentFocusStore } from "@/src/hooks/comment_focus_store";
import { userLabel } from "@/src/utils/deleted_labels";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import CommentBody from "./comment_body";
import CommentComposer from "./comment_composer";

const MAX_INDENT_LEVEL = 3;
const INDENT = 12;

type Mode = { kind: "new" } | { kind: "reply"; to: ItemComment } | { kind: "edit"; comment: ItemComment };

function Action({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xxs,
        minHeight: sizes.touch,
        paddingHorizontal: spacing.xs,
        backgroundColor: pressed ? colors.surfaceAlt : "transparent",
      })}
    >
      <MaterialIcons name={icon} size={18} color={color} />
      <Text style={[typography.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

function CommentRow({
  comment,
  level,
  parentAuthor,
  onReply,
  onEdit,
  onDelete,
  onReport,
  highlightId,
}: {
  comment: ItemComment;
  level: number;
  parentAuthor?: string | null;
  onReply: (c: ItemComment) => void;
  onEdit: (c: ItemComment) => void;
  onDelete: (c: ItemComment) => void;
  onReport: (c: ItemComment) => void;
  /** The comment opened from My activity: tinted for a moment. */
  highlightId?: string | null;
}) {
  const { t } = useTranslation();
  const hidden = comment.isDeleted || comment.isRemoved;
  const indent = Math.min(level, MAX_INDENT_LEVEL);
  // Deeper than the indent limit: say who it answers, so the thread stays readable.
  const answering = level > MAX_INDENT_LEVEL && parentAuthor ? t("comments:row.answering", { name: parentAuthor }) : null;
  const meta = [answering, formatTimeAgo(comment.createdAt), comment.editedAt ? t("comments:row.edited") : null].filter(Boolean).join(" · "); // i18n-ignore

  return (
    <View>
      <View
        style={{
          marginLeft: indent * INDENT,
          borderLeftWidth: level > 0 ? borders.width : 0,
          borderLeftColor: colors.borderMuted,
          paddingLeft: level > 0 ? spacing.sm : 0,
          paddingTop: spacing.sm,
          gap: spacing.xxs,
          backgroundColor: comment.id === highlightId ? colors.surfaceAlt : "transparent",
        }}
        accessibilityState={comment.id === highlightId ? { selected: true } : undefined}
      >
        {hidden ? (
          <Text style={[typography.meta, { color: colors.textMuted, fontStyle: "italic", paddingBottom: spacing.sm }]}>
            {comment.isRemoved ? t("comments:row.removed") : t("comments:row.deleted")}
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
              <Avatar uri={comment.author?.avatar} size={32} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" }}>
                  <Text style={[typography.label, { color: colors.text }]}>{userLabel(comment.author, t)}</Text>
                  {comment.isOwner ? <Tag label={t("comments:row.owner")} color={colors.secondary} /> : null}
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>{meta}</Text>
              </View>
            </View>
            <CommentBody body={comment.body} mentions={comment.mentions} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: -spacing.xs }}>
              <Action icon="reply" label={t("comments:row.reply")} onPress={() => onReply(comment)} />
              {comment.canEdit ? (
                <>
                  <Action icon="edit" label={t("common:actions.edit")} onPress={() => onEdit(comment)} />
                  <Action icon="delete-outline" label={t("common:actions.delete")} danger onPress={() => onDelete(comment)} />
                </>
              ) : (
                <Action icon="flag" label={t("comments:row.report")} danger onPress={() => onReport(comment)} />
              )}
            </View>
          </>
        )}
      </View>
      {comment.replies.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          level={level + 1}
          parentAuthor={comment.author ? userLabel(comment.author, t) : undefined}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          highlightId={highlightId}
        />
      ))}
    </View>
  );
}

const HIGHLIGHT_MS = 2500;

function contains(comment: ItemComment, id: string): boolean {
  return comment.id === id || comment.replies.some((r) => contains(r, id));
}

/**
 * Comments of one collection item — the same component on the item details pages and in the feed card sheet.
 * Rendered without a virtualized list so it can live inside the details ScrollView. When a comment was opened from
 * My activity, its thread is scrolled into view (onFocusY: y inside this section) and the comment tinted briefly.
 */
function CommentSection({ itemId, onFocusY }: { itemId: string; onFocusY?: (y: number) => void }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useItemComments(itemId);
  const [mode, setMode] = useState<Mode>({ kind: "new" });
  const [reporting, setReporting] = useState<ItemComment | null>(null);
  const [deleting, setDeleting] = useState<ItemComment | null>(null);

  const create = useCommentMutation(itemId, (args: { body: string; mentionUserIds: string[]; parentId?: string | null }) =>
    commentApi.create(itemId, args),
  );
  const update = useCommentMutation(itemId, (args: { id: string; body: string; mentionUserIds: string[] }) =>
    commentApi.update(itemId, args.id, { body: args.body, mentionUserIds: args.mentionUserIds }),
  );
  const remove = useCommentMutation(itemId, (id: string) => commentApi.remove(itemId, id), t("comments:deleted"));

  const threads = data?.pages.flatMap((p) => p.threads) ?? [];
  const total = data?.pages[0]?.totalComments ?? 0;

  const focusItemId = useCommentFocusStore((s) => s.itemId);
  const focusCommentId = useCommentFocusStore((s) => s.commentId);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const threadsY = useRef(0);
  const threadY = useRef<Record<string, number>>({});

  useEffect(() => {
    if (focusItemId !== itemId || !focusCommentId || isLoading) return;
    useCommentFocusStore.getState().clear();
    const thread = threads.find((th) => contains(th, focusCommentId));
    if (!thread) {
      // Not among the loaded threads (or deleted since): show the comments at least.
      onFocusY?.(0);
      return;
    }
    setHighlightId(focusCommentId);
    // Wait for the rows to be laid out before measuring.
    const timer = setTimeout(() => onFocusY?.(threadsY.current + (threadY.current[thread.id] ?? 0)), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusItemId, focusCommentId, itemId, isLoading, threads.length]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const submit = async (body: string, mentionUserIds: string[]) => {
    if (mode.kind === "edit") await update.mutateAsync({ id: mode.comment.id, body, mentionUserIds });
    else await create.mutateAsync({ body, mentionUserIds, parentId: mode.kind === "reply" ? mode.to.id : null });
    setMode({ kind: "new" });
  };

  const context =
    mode.kind === "reply"
      ? t("comments:composer.replyingTo", { name: userLabel(mode.to.author, t) })
      : mode.kind === "edit"
        ? t("comments:composer.editing")
        : null;

  return (
    <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
      <SectionHeader title={total > 0 ? t("comments:titleCount", { count: total }) : t("comments:title")} />
      <CommentComposer
        context={context}
        onCancelContext={() => setMode({ kind: "new" })}
        initialText={mode.kind === "edit" ? mode.comment.body : mode.kind === "reply" && mode.to.author && !mode.to.author.isDeleted ? `@${mode.to.author.name} ` : ""}
        initialMentions={
          mode.kind === "edit"
            ? mode.comment.mentions
            : mode.kind === "reply" && mode.to.author
              ? [{ userId: mode.to.author.id, name: mode.to.author.name }]
              : []
        }
        submitLabel={mode.kind === "edit" ? t("common:actions.save") : mode.kind === "reply" ? t("comments:row.reply") : t("comments:composer.post")}
        loading={create.isPending || update.isPending}
        onSubmit={submit}
      />

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState message={apiErrorText(error, "comments:loadFailed")} onRetry={() => refetch()} />
      ) : threads.length === 0 ? (
        <Text style={[typography.body, { color: colors.textMuted, fontStyle: "italic" }]}>{t("comments:empty")}</Text>
      ) : (
        <View onLayout={(e) => (threadsY.current = e.nativeEvent.layout.y)}>
          {threads.map((thread, i) => (
            <View
              key={thread.id}
              onLayout={(e) => (threadY.current[thread.id] = e.nativeEvent.layout.y)}
              style={{ borderTopWidth: i === 0 ? 0 : borders.hairline, borderColor: colors.borderMuted }}
            >
              <CommentRow
                comment={thread}
                level={0}
                onReply={(to) => setMode({ kind: "reply", to })}
                onEdit={(comment) => setMode({ kind: "edit", comment })}
                onDelete={setDeleting}
                onReport={setReporting}
                highlightId={highlightId}
              />
            </View>
          ))}
        </View>
      )}

      {hasNextPage ? (
        <Pressable
          onPress={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          accessibilityRole="button"
          style={({ pressed }) => ({ alignSelf: "center", minHeight: sizes.touch, justifyContent: "center", paddingHorizontal: spacing.md, opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[typography.label, { color: colors.text, textDecorationLine: "underline" }]}>
            {isFetchingNextPage ? t("common:states.loading") : t("comments:older")}
          </Text>
        </Pressable>
      ) : null}

      <ConfirmDialog
        isVisible={!!deleting}
        title={t("comments:deleteTitle")}
        message={t("comments:deleteText")}
        confirmLabel={t("common:actions.delete")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSettled: () => setDeleting(null) })}
      />
      <ReportOverlay isVisible={!!reporting} onClose={() => setReporting(null)} targetType="comment" targetId={reporting?.id ?? ""} />
    </View>
  );
}

export default CommentSection;
