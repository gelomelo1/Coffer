import { colors, fonts, typography } from "@/src/theme/theme";
import { Mention } from "@/src/types/entities/comment";
import { StyleProp, Text, TextStyle } from "react-native";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Plain-text comment body (line breaks and emoji kept). Only mentions the backend confirmed (stored by user id)
 * are highlighted; any other "@word" stays ordinary text.
 */
function CommentBody({ body, mentions, style }: { body: string; mentions: Mention[]; style?: StyleProp<TextStyle> }) {
  const base = [typography.body, { color: colors.text }, style];
  // A deleted account's mention has no name left to highlight (its "@Name" stays plain text).
  const live = mentions.filter((m) => !m.isDeleted && m.name.length > 0);
  if (live.length === 0) return <Text style={base}>{body}</Text>;

  const names = [...live].sort((a, b) => b.name.length - a.name.length).map((m) => escape(m.name));
  const pattern = new RegExp(`(@(?:${names.join("|")}))(?![\\p{L}\\p{N}_.-])`, "giu");
  const parts = body.split(pattern);

  return (
    <Text style={base}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ fontFamily: fonts.bold, textDecorationLine: "underline" }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

export default CommentBody;
