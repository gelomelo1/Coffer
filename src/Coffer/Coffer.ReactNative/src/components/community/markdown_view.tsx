import CustomImage from "@/src/components/custom_ui/custom_image";
import { borders, colors, fonts, spacing, typography } from "@/src/theme/theme";
import { imageNameOf } from "@/src/utils/app_links";
import { newsImage } from "@/src/utils/news_api";
import { openAppLink } from "@/src/utils/open_app_link";
import Markdown, { MarkdownIt, RenderRules } from "@ronradtke/react-native-markdown-display";
import { useEffect, useState } from "react";
import { Image, Platform, View } from "react-native";

// No raw HTML and no auto-linking: a post is exactly the markdown the Manager wrote.
const parser = MarkdownIt({ html: false, linkify: false, typographer: true });
const mono = Platform.select({ ios: "Menlo", default: "monospace" });

/** A content image at its own proportions (measured once loaded); full width, tap for full screen. */
function PostImage({ name, alt }: { name: string; alt?: string }) {
  const uri = newsImage(name);
  const [aspect, setAspect] = useState(16 / 9);
  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (w, h) => alive && w > 0 && h > 0 && setAspect(w / h), () => {});
    return () => {
      alive = false;
    };
  }, [uri]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={alt || undefined}
      style={{ width: "100%", marginVertical: spacing.xs, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
    >
      <CustomImage uri={uri} style={{ width: "100%", aspectRatio: aspect }} enableFullScreenView />
    </View>
  );
}

const rules: RenderRules = {
  // Only images uploaded to the news store are shown; any other source (a web URL, a tracking pixel) is dropped.
  image: (node) => {
    const name = imageNameOf(String(node.attributes.src ?? ""));
    return name ? <PostImage key={node.key} name={name} alt={node.attributes.alt} /> : null;
  },
};

const styles = {
  body: { ...typography.body, color: colors.text },
  paragraph: { marginTop: 0, marginBottom: spacing.sm, flexWrap: "wrap", flexDirection: "row", alignItems: "flex-start", width: "100%" },
  heading1: { ...typography.headline, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  heading2: { ...typography.title, color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  heading3: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xxs },
  heading4: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xxs },
  heading5: { ...typography.label, color: colors.text, marginTop: spacing.sm },
  heading6: { ...typography.label, color: colors.textMuted, marginTop: spacing.sm },
  strong: { fontFamily: fonts.bold },
  em: { fontFamily: fonts.italic },
  s: { textDecorationLine: "line-through" },
  link: { fontFamily: fonts.bold, color: colors.text, textDecorationLine: "underline" },
  blockquote: {
    backgroundColor: colors.surfaceAlt,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginVertical: spacing.xs,
    marginLeft: 0,
  },
  bullet_list: { marginBottom: spacing.sm },
  ordered_list: { marginBottom: spacing.sm },
  list_item: { marginBottom: spacing.xxs },
  bullet_list_icon: { color: colors.secondary, fontFamily: fonts.bold, marginRight: spacing.xs },
  ordered_list_icon: { color: colors.text, fontFamily: fonts.bold, marginRight: spacing.xs },
  code_inline: { fontFamily: mono, fontSize: 14, backgroundColor: colors.surfaceAlt, borderWidth: 0, paddingHorizontal: spacing.xxs },
  code_block: { fontFamily: mono, fontSize: 14, backgroundColor: colors.surfaceAlt, borderWidth: borders.hairline, borderColor: colors.borderMuted, padding: spacing.sm },
  fence: { fontFamily: mono, fontSize: 14, backgroundColor: colors.surfaceAlt, borderWidth: borders.hairline, borderColor: colors.borderMuted, padding: spacing.sm, marginBottom: spacing.sm },
  hr: { backgroundColor: colors.border, height: borders.width, marginVertical: spacing.md },
  table: { borderWidth: borders.hairline, borderColor: colors.border, marginBottom: spacing.sm },
  th: { padding: spacing.xs, fontFamily: fonts.bold, backgroundColor: colors.surfaceAlt },
  td: { padding: spacing.xs },
  tr: { borderBottomWidth: borders.hairline, borderColor: colors.borderMuted, flexDirection: "row" },
} as const;

/**
 * A news post's markdown, in the app's look. Links never go to the OS directly: app links open their page, web and
 * mail links the system, anything else says it can't be opened.
 */
export function MarkdownView({ content }: { content: string }) {
  return (
    <Markdown
      markdownit={parser}
      rules={rules}
      style={styles as any}
      onLinkPress={(url) => {
        openAppLink(url);
        return false;
      }}
    >
      {content}
    </Markdown>
  );
}
