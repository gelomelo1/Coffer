import { colors, fonts, spacing, typography } from "@/src/theme/theme";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import RenderHTML, { MixedStyleRecord } from "react-native-render-html";
import { RICH_TEXT } from "./rich_text_css";

interface CustomHTMLViewProps {
  content: string;
  /** Collapse long content behind "Read more". */
  foldable?: boolean;
  /** Lines visible when collapsed (foldable) or as a hard clip (preview). */
  maxLines?: number;
}

const tagsStyles: MixedStyleRecord = {
  b: { fontFamily: fonts.bold },
  strong: { fontFamily: fonts.bold },
  i: { fontStyle: "italic" },
  em: { fontStyle: "italic" },
  u: { textDecorationLine: "underline" },
  s: { textDecorationLine: "line-through" },
  h1: { fontSize: RICH_TEXT.headings.h1, fontFamily: fonts.bold, marginTop: 8, marginBottom: 4 },
  h2: { fontSize: RICH_TEXT.headings.h2, fontFamily: fonts.bold, marginTop: 8, marginBottom: 4 },
  h3: { fontSize: RICH_TEXT.headings.h3, fontFamily: fonts.bold, marginTop: 8, marginBottom: 4 },
  h4: { fontSize: RICH_TEXT.headings.h4, fontFamily: fonts.bold, marginTop: 8, marginBottom: 4 },
  h5: { fontSize: RICH_TEXT.headings.h5, fontFamily: fonts.bold, marginTop: 8, marginBottom: 4 },
  h6: { fontSize: RICH_TEXT.headings.h6, fontFamily: fonts.bold, marginTop: 8, marginBottom: 4 },
  p: { marginTop: 0, marginBottom: 0, minHeight: RICH_TEXT.lineHeight },
  ul: { marginTop: 4, marginBottom: 4, paddingLeft: RICH_TEXT.listIndent },
  ol: { marginTop: 4, marginBottom: 4, paddingLeft: RICH_TEXT.listIndent },
  li: { marginTop: 0, marginBottom: 0 },
  blockquote: { marginVertical: 8, paddingHorizontal: 12, paddingVertical: 4, borderLeftWidth: 4, borderLeftColor: colors.secondary },
  a: { textDecorationLine: "underline", color: colors.text, fontFamily: fonts.bold },
  code: { fontFamily: "monospace", backgroundColor: RICH_TEXT.codeBg, fontSize: 14 },
  pre: { fontFamily: "monospace", backgroundColor: RICH_TEXT.codeBg, borderWidth: 2, borderColor: colors.border, padding: 8, marginVertical: 8, fontSize: 14 },
};

/** Read-only rendering of user rich text (descriptions, bios). Content is shown exactly as stored. */
function CustomHTMLView({ content, foldable = false, maxLines }: CustomHTMLViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const clipHeight = (maxLines ?? 3) * RICH_TEXT.lineHeight;
  const clipped = foldable ? !isOpen : maxLines !== undefined;
  const isOverflowing = contentHeight > clipHeight;

  return (
    <View style={{ paddingHorizontal: spacing.sm }}>
      <View style={{ maxHeight: clipped ? clipHeight : undefined, overflow: "hidden" }}>
        <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
          <RenderHTML
            contentWidth={width - 2 * spacing.md}
            systemFonts={[fonts.regular, fonts.bold, fonts.italic, fonts.semibold]}
            baseStyle={{ color: colors.text, fontFamily: fonts.regular, fontSize: RICH_TEXT.fontSize, lineHeight: RICH_TEXT.lineHeight }}
            tagsStyles={tagsStyles}
            source={{ html: content }}
          />
        </View>
      </View>
      {foldable && isOverflowing && !isOpen ? (
        <Pressable onPress={() => setIsOpen(true)} accessibilityRole="button" hitSlop={8} style={{ paddingTop: spacing.xxs }}>
          <Text style={[typography.label, { color: colors.text, textDecorationLine: "underline" }]}>{t("common:actions.readMore")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default CustomHTMLView;
