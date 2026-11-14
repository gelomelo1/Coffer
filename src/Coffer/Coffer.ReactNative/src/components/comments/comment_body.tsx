import CustomText from "@/src/components/custom_ui/custom_text";
import { customTheme } from "@/src/theme/theme";
import { Mention } from "@/src/types/entities/comment";
import { StyleProp, TextStyle } from "react-native";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Plain-text comment body (line breaks and emoji kept). Only mentions the backend confirmed (stored by user id)
 * are highlighted; any other "@word" stays ordinary text.
 */
function CommentBody({ body, mentions, style }: { body: string; mentions: Mention[]; style?: StyleProp<TextStyle> }) {
  if (mentions.length === 0) return <CustomText style={style}>{body}</CustomText>;

  const names = [...mentions].sort((a, b) => b.name.length - a.name.length).map((m) => escape(m.name));
  const pattern = new RegExp(`(@(?:${names.join("|")}))(?![\\p{L}\\p{N}_.-])`, "giu");
  const parts = body.split(pattern);

  return (
    <CustomText style={style}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <CustomText key={i} style={{ fontFamily: "VendSansBold", color: customTheme.colors.primary, textDecorationLine: "underline" }}>
            {part}
          </CustomText>
        ) : (
          part
        ),
      )}
    </CustomText>
  );
}

export default CommentBody;
