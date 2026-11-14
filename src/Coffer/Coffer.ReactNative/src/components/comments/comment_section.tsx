import CustomText from "@/src/components/custom_ui/custom_text";
import { Loading } from "@/src/components/custom_ui/loading";
import ReportOverlay from "@/src/components/market/ui/report_overlay";
import { Tag } from "@/src/components/market/ui/retro";
import { commentApi, useCommentMutation, useItemComments } from "@/src/hooks/comment_api";
import { customTheme } from "@/src/theme/theme";
import { ItemComment } from "@/src/types/entities/comment";
import { apiErrorMessage, formatTimeAgo } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import { Avatar } from "react-native-elements";
import CommentBody from "./comment_body";
import CommentComposer from "./comment_composer";

const c = customTheme.colors;
const MAX_INDENT_LEVEL = 3;

type Mode = { kind: "new" } | { kind: "reply"; to: ItemComment } | { kind: "edit"; comment: ItemComment };

function Action({ icon, label, onPress }: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={6} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <MaterialIcons name={icon} size={14} color={c.primary} />
      <CustomText style={{ fontSize: 13 }}>{label}</CustomText>
    </TouchableOpacity>
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
}: {
  comment: ItemComment;
  level: number;
  parentAuthor?: string | null;
  onReply: (c: ItemComment) => void;
  onEdit: (c: ItemComment) => void;
  onDelete: (c: ItemComment) => void;
  onReport: (c: ItemComment) => void;
}) {
  const hidden = comment.isDeleted || comment.isRemoved;
  const indent = Math.min(level, MAX_INDENT_LEVEL);
  // Deeper than the indent limit: say who it answers, so the thread stays readable.
  const answering = level > MAX_INDENT_LEVEL && parentAuthor ? `↪ ${parentAuthor} · ` : "";

  return (
    <View>
      <View
        style={{
          marginLeft: indent * 14,
          borderLeftWidth: level > 0 ? 2 : 0,
          borderLeftColor: c.primary,
          paddingLeft: level > 0 ? 8 : 0,
          paddingVertical: 6,
          gap: 3,
        }}
      >
        {hidden ? (
          <CustomText style={{ fontFamily: "VendSansItalic", fontSize: 14 }}>
            {comment.isRemoved ? "[comment removed by a moderator]" : "[deleted comment]"}
          </CustomText>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Avatar
                size={22}
                rounded
                source={comment.author?.avatar ? { uri: comment.author.avatar } : undefined}
                title={comment.author?.name?.[0]?.toUpperCase()}
                containerStyle={{ backgroundColor: c.primary }}
              />
              <CustomText style={{ fontFamily: "VendSansBold" }}>{comment.author?.name}</CustomText>
              {comment.isOwner ? <Tag label="OWNER" color={c.secondary} textColor={c.primary} /> : null}
              <CustomText style={{ fontSize: 12 }}>
                {answering}
                {formatTimeAgo(comment.createdAt)}
                {comment.editedAt ? " · edited" : ""}
              </CustomText>
            </View>
            <CommentBody body={comment.body} mentions={comment.mentions} />
            <View style={{ flexDirection: "row", gap: 14 }}>
              <Action icon="reply" label="Reply" onPress={() => onReply(comment)} />
              {comment.canEdit ? (
                <>
                  <Action icon="edit" label="Edit" onPress={() => onEdit(comment)} />
                  <Action icon="delete-outline" label="Delete" onPress={() => onDelete(comment)} />
                </>
              ) : (
                <Action icon="flag" label="Report" onPress={() => onReport(comment)} />
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
          parentAuthor={comment.author?.name}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
        />
      ))}
    </View>
  );
}

/**
 * Comments of one collection item — the same component on the item details pages and in the feed card sheet.
 * Rendered without a virtualized list so it can live inside the details ScrollView.
 */
function CommentSection({ itemId }: { itemId: string }) {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useItemComments(itemId);
  const [mode, setMode] = useState<Mode>({ kind: "new" });
  const [reporting, setReporting] = useState<ItemComment | null>(null);

  const create = useCommentMutation(itemId, (args: { body: string; mentionUserIds: string[]; parentId?: string | null }) =>
    commentApi.create(itemId, args),
  );
  const update = useCommentMutation(itemId, (args: { id: string; body: string; mentionUserIds: string[] }) =>
    commentApi.update(itemId, args.id, { body: args.body, mentionUserIds: args.mentionUserIds }),
  );
  const remove = useCommentMutation(itemId, (id: string) => commentApi.remove(itemId, id), "Comment deleted");

  const threads = data?.pages.flatMap((p) => p.threads) ?? [];
  const total = data?.pages[0]?.totalComments ?? 0;

  const submit = async (body: string, mentionUserIds: string[]) => {
    if (mode.kind === "edit") await update.mutateAsync({ id: mode.comment.id, body, mentionUserIds });
    else await create.mutateAsync({ body, mentionUserIds, parentId: mode.kind === "reply" ? mode.to.id : null });
    setMode({ kind: "new" });
  };

  const confirmDelete = (comment: ItemComment) =>
    Alert.alert("Delete comment?", "Replies to it stay visible.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate(comment.id) },
    ]);

  const context =
    mode.kind === "reply" ? `Replying to ${mode.to.author?.name ?? "comment"}` : mode.kind === "edit" ? "Editing your comment" : null;

  return (
    <View style={{ gap: 8, marginBottom: 20 }}>
      <CustomText style={{ fontSize: 20 }}>Comments{total > 0 ? ` (${total})` : ""}</CustomText>
      <CommentComposer
        context={context}
        onCancelContext={() => setMode({ kind: "new" })}
        initialText={mode.kind === "edit" ? mode.comment.body : mode.kind === "reply" && mode.to.author ? `@${mode.to.author.name} ` : ""}
        initialMentions={
          mode.kind === "edit"
            ? mode.comment.mentions
            : mode.kind === "reply" && mode.to.author
              ? [{ userId: mode.to.author.id, name: mode.to.author.name }]
              : []
        }
        submitLabel={mode.kind === "edit" ? "Save" : mode.kind === "reply" ? "Reply" : "Post"}
        loading={create.isPending || update.isPending}
        onSubmit={submit}
      />

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <TouchableOpacity onPress={() => refetch()}>
          <CustomText style={{ color: "red" }}>{apiErrorMessage(error, "Couldn't load the comments.")} Tap to retry.</CustomText>
        </TouchableOpacity>
      ) : threads.length === 0 ? (
        <CustomText style={{ fontFamily: "VendSansItalic" }}>No comments yet. Start the conversation!</CustomText>
      ) : (
        threads.map((thread) => (
          <CommentRow
            key={thread.id}
            comment={thread}
            level={0}
            onReply={(to) => setMode({ kind: "reply", to })}
            onEdit={(comment) => setMode({ kind: "edit", comment })}
            onDelete={confirmDelete}
            onReport={setReporting}
          />
        ))
      )}

      {hasNextPage ? (
        <TouchableOpacity onPress={() => fetchNextPage()} disabled={isFetchingNextPage} style={{ alignSelf: "center", padding: 6 }}>
          <CustomText style={{ textDecorationLine: "underline" }}>{isFetchingNextPage ? "Loading…" : "Show older comments"}</CustomText>
        </TouchableOpacity>
      ) : null}

      <ReportOverlay
        isVisible={!!reporting}
        onClose={() => setReporting(null)}
        targetType="comment"
        targetId={reporting?.id ?? ""}
      />
    </View>
  );
}

export default CommentSection;
