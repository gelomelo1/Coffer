import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { useMentionable } from "@/src/hooks/comment_api";
import { customTheme } from "@/src/theme/theme";
import { Mention } from "@/src/types/entities/comment";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";

const c = customTheme.colors;
export const MAX_COMMENT = 2000;

/** "@partial" being typed at the end of the text, or null. */
function typedMention(text: string): string | null {
  const match = /(^|\s)@([^\s@]*)$/.exec(text);
  return match ? match[2] : null;
}

/**
 * Text box for a new comment, a reply or an edit. Typing "@" suggests users; a picked user is inserted as "@Name"
 * and sent as a mention id (the backend keeps it only if "@Name" is really in the text).
 */
function CommentComposer({
  initialText = "",
  initialMentions = [],
  context,
  onCancelContext,
  submitLabel,
  loading,
  onSubmit,
}: {
  initialText?: string;
  initialMentions?: Mention[];
  /** "Replying to Anna" / "Editing your comment" line with a cancel button. */
  context?: string | null;
  onCancelContext?: () => void;
  submitLabel: string;
  loading: boolean;
  onSubmit: (body: string, mentionUserIds: string[]) => Promise<unknown> | void;
}) {
  const [text, setText] = useState(initialText);
  const [mentions, setMentions] = useState<Mention[]>(initialMentions);
  useEffect(() => {
    setText(initialText);
    setMentions(initialMentions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText, context]);

  const query = typedMention(text);
  const { data: suggestions = [] } = useMentionable(query);

  const pick = (m: Mention) => {
    setText((t) => t.replace(/@([^\s@]*)$/, `@${m.name} `));
    setMentions((list) => (list.some((x) => x.userId === m.userId) ? list : [...list, m]));
  };

  const submit = async () => {
    const body = text.trim();
    const ids = mentions.filter((m) => body.includes(`@${m.name}`)).map((m) => m.userId);
    try {
      await onSubmit(body, ids);
    } catch {
      return; // the error toast is shown by the mutation; keep the text for another try
    }
    setText("");
    setMentions([]);
  };

  const length = text.trim().length;

  return (
    <View style={{ gap: 4 }}>
      {context ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialIcons name="subdirectory-arrow-right" size={16} color={c.primary} />
          <CustomText style={{ fontSize: 13, flex: 1 }}>{context}</CustomText>
          <TouchableOpacity onPress={onCancelContext} hitSlop={10}>
            <MaterialIcons name="close" size={18} color={c.primary} />
          </TouchableOpacity>
        </View>
      ) : null}
      <CustomTextInput
        placeholder="Write a comment… use @ to mention someone"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={MAX_COMMENT}
        containerStyle={{ minHeight: 60, maxHeight: 160 }}
      />
      {query != null && suggestions.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {suggestions.map((m) => (
            <TouchableOpacity
              key={m.userId}
              onPress={() => pick(m)}
              style={{ borderWidth: 2, borderColor: c.primary, backgroundColor: c.secondary, paddingHorizontal: 8, paddingVertical: 2 }}
            >
              <CustomText style={{ fontSize: 14 }}>@{m.name}</CustomText>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <CustomText style={{ fontSize: 12 }}>
          {length}/{MAX_COMMENT}
        </CustomText>
        <CustomButton title={submitLabel} disabled={length === 0 || length > MAX_COMMENT || loading} loading={loading} onPress={submit} />
      </View>
    </View>
  );
}

export default CommentComposer;
