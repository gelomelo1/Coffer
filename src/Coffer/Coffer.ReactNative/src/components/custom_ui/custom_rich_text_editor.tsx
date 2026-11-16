import { useKeyboardToolbarOffset } from "@/src/hooks/keyboard_toolbar";
import { borders, colors, spacing } from "@/src/theme/theme";
import { CoreBridge, LinkBridge, PlaceholderBridge, RichText, TenTapStartKit, useBridgeState, useEditorBridge } from "@10play/tentap-editor";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { DimensionValue, View } from "react-native";
import { RICH_TEXT_EDITOR_CSS } from "./rich_text_css";
import RichTextToolbar, { RICH_TOOLBAR_HEIGHT } from "./rich_text_toolbar";

interface CustomRichTextEditorProps {
  initialContent: string;
  onChangeValue: (value: string) => void;
  placeholder?: string;
  /** Fixed height of the editing area; omit to fill the parent (recommended — e.g. inside RichTextEditorSheet). */
  richTextHeight?: DimensionValue;
  margin?: number;
  autofocus?: boolean;
}

/**
 * Rich text editor (tentap) in Coffer style. The formatting toolbar is anchored to the real keyboard frame, so it
 * sits directly on the keyboard on every phone size; the editing area shrinks so the caret is never under it.
 */
function CustomRichTextEditor({ initialContent, onChangeValue, placeholder, richTextHeight, margin, autofocus = false }: CustomRichTextEditorProps) {
  const { t } = useTranslation();
  const hostRef = useRef<View>(null);
  const { bottom, onHostLayout } = useKeyboardToolbarOffset(hostRef);

  const editor = useEditorBridge({
    autofocus,
    avoidIosKeyboard: true,
    editable: true,
    initialContent,
    theme: { webview: { backgroundColor: colors.bg }, webviewContainer: { backgroundColor: colors.bg } },
    bridgeExtensions: [
      ...TenTapStartKit,
      CoreBridge.configureCSS(RICH_TEXT_EDITOR_CSS),
      PlaceholderBridge.configureExtension({ placeholder: placeholder ?? t("common:richText.placeholder") }),
      LinkBridge.configureExtension({ openOnClick: false }),
    ],
    onChange() {
      editor.getHTML().then(onChangeValue);
    },
  });
  const { isFocused } = useBridgeState(editor);

  const toolbarVisible = bottom !== null;

  return (
    <View ref={hostRef} onLayout={onHostLayout} style={{ flex: richTextHeight ? undefined : 1, marginHorizontal: margin }}>
      <View
        style={{
          height: richTextHeight,
          flex: richTextHeight ? undefined : 1,
          minHeight: 160,
          borderWidth: borders.width,
          borderColor: isFocused ? colors.secondary : colors.border,
          backgroundColor: colors.bg,
          marginBottom: toolbarVisible ? bottom + RICH_TOOLBAR_HEIGHT : richTextHeight ? 0 : spacing.md,
        }}
      >
        <RichText editor={editor} />
      </View>
      {toolbarVisible ? (
        <View style={{ position: "absolute", left: margin ? -margin : 0, right: margin ? -margin : 0, bottom }}>
          <RichTextToolbar editor={editor} />
        </View>
      ) : null}
    </View>
  );
}

export default CustomRichTextEditor;
