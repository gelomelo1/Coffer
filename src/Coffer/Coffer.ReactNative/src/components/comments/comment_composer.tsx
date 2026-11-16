import { Chip, ChipRow } from "@/src/components/custom_ui/chip";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { useMentionable } from "@/src/hooks/comment_api";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Mention } from "@/src/types/entities/comment";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

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
  const { t } = useTranslation();
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
    setText((current) => current.replace(/@([^\s@]*)$/, `@${m.name} `));
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
    <View style={{ gap: spacing.xs }}>
      {context ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            borderLeftWidth: 4,
            borderLeftColor: colors.secondary,
            paddingLeft: spacing.sm,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <MaterialIcons name="subdirectory-arrow-right" size={sizes.iconSm} color={colors.text} />
          <Text style={[typography.label, { color: colors.text, flex: 1 }]}>{context}</Text>
          <Pressable
            onPress={onCancelContext}
            accessibilityRole="button"
            accessibilityLabel={t("comments:composer.cancelContext")}
            style={({ pressed }) => ({ width: sizes.touch, height: sizes.touch, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
          >
            <MaterialIcons name="close" size={sizes.iconMd} color={colors.text} />
          </Pressable>
        </View>
      ) : null}
      <CustomTextInput
        placeholder={t("comments:composer.placeholder")}
        accessibilityLabel={t("comments:composer.label")}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={MAX_COMMENT}
        containerStyle={{ maxHeight: 180 }}
      />
      {query != null && suggestions.length > 0 ? (
        <View style={{ gap: spacing.xxs }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{t("comments:composer.mentionHint")}</Text>
          <ChipRow>
            {suggestions.map((m) => (
              <Chip
                key={m.userId}
                label={`@${m.name}`} // i18n-ignore
                accessibilityLabel={t("comments:composer.mention", { name: m.name })}
                onPress={() => pick(m)}
                style={{ borderWidth: borders.width }}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{t("comments:composer.count", { length, max: MAX_COMMENT })}</Text>
        <CustomButton
          title={submitLabel}
          icon={<MaterialIcons name="send" size={sizes.iconSm} color={length === 0 ? colors.textMuted : colors.onPrimary} />}
          disabled={length === 0 || length > MAX_COMMENT || loading}
          loading={loading}
          onPress={submit}
        />
      </View>
    </View>
  );
}

export default CommentComposer;
