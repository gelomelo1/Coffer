import { colors } from "@/src/theme/theme";
import { EDITOR_FONT_FACES } from "./editor_fonts";

/**
 * Shared typography for rich text — the editor WebView uses this CSS and CustomHTMLView mirrors the same values,
 * so text looks the same while editing and when displayed.
 */
export const RICH_TEXT = {
  fontSize: 16,
  lineHeight: 24,
  headings: { h1: 24, h2: 21, h3: 19, h4: 17, h5: 16, h6: 15 },
  listIndent: 20,
  codeBg: "#efeee0",
} as const;

export const RICH_TEXT_EDITOR_CSS = `
${EDITOR_FONT_FACES}
html, body {
  background-color: ${colors.bg};
  margin: 0;
  padding: 0;
}
* { color: ${colors.text}; box-sizing: border-box; }
body, .ProseMirror {
  font-family: 'VendSans', sans-serif;
  font-size: ${RICH_TEXT.fontSize}px;
  line-height: ${RICH_TEXT.lineHeight / RICH_TEXT.fontSize};
  -webkit-text-size-adjust: 100%;
}
.ProseMirror { padding: 12px 12px 24px; min-height: 100%; outline: none; caret-color: ${colors.primary}; }
p { margin: 0; }
h1, h2, h3, h4, h5, h6 { font-weight: 700; margin: 8px 0 4px; line-height: 1.25; }
h1 { font-size: ${RICH_TEXT.headings.h1}px; } h2 { font-size: ${RICH_TEXT.headings.h2}px; }
h3 { font-size: ${RICH_TEXT.headings.h3}px; } h4 { font-size: ${RICH_TEXT.headings.h4}px; }
h5 { font-size: ${RICH_TEXT.headings.h5}px; } h6 { font-size: ${RICH_TEXT.headings.h6}px; }
ul, ol { margin: 4px 0; padding-left: ${RICH_TEXT.listIndent}px; }
li { margin: 0; }
blockquote { margin: 8px 0; padding: 4px 12px; border-left: 4px solid ${colors.secondary}; }
a { text-decoration: underline; color: ${colors.text}; font-weight: 700; }
code { font-family: monospace; background-color: ${RICH_TEXT.codeBg}; padding: 1px 4px; font-size: 14px; }
pre { font-family: monospace; background-color: ${RICH_TEXT.codeBg}; border: 2px solid ${colors.border}; padding: 8px; margin: 8px 0; white-space: pre-wrap; font-size: 14px; }
ul[data-type="taskList"] { list-style: none; padding-left: 4px; }
ul[data-type="taskList"] li { display: flex; gap: 8px; align-items: flex-start; }
ul[data-type="taskList"] input { width: 18px; height: 18px; margin-top: 3px; accent-color: ${colors.primary}; }
p.is-editor-empty:first-child::before { color: ${colors.textMuted}; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
`;
