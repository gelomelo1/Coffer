import { customTheme } from "@/src/theme/theme";
import {
  CodeBridge,
  LinkBridge,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
} from "@10play/tentap-editor";
import { KeyboardAvoidingView, View } from "react-native";

interface CustomRichTextEditorProps {
  initialContent: string;
  onChangeValue: (value: string) => void;
  placeholder?: string;
  richTextHeight?: number;
  keyboadVerticalOffset?: number;
  margin?: number;
}

function CustomRichTextEditor({
  initialContent,
  onChangeValue,
  placeholder,
  richTextHeight,
  keyboadVerticalOffset,
  margin,
}: CustomRichTextEditorProps) {
  const customCodeBlockCSS = `
  html, body {
  background-color: ${customTheme.colors.background};
  margin: 0;
  padding: 0;
  font-size: 14px;        /* ✅ base size */
  line-height: 1.3;
}

/* Global reset */
* {
  color: ${customTheme.colors.primary};
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Paragraphs — keep block, but remove ALL spacing */
p {
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.3;
}

/* Prevent extra spacing between paragraphs */
p + p {
  margin-top: 0 !important;
}

/* Headings — scaled, but no spacing */
h1 { font-size: 20px; font-weight: bold; margin: 0; }
h2 { font-size: 18px; font-weight: bold; margin: 0; }
h3 { font-size: 16px; font-weight: bold; margin: 0; }
h4 { font-size: 15px; font-weight: bold; margin: 0; }
h5 { font-size: 14px; font-weight: bold; margin: 0; }
h6 { font-size: 13px; font-weight: bold; margin: 0; }

/* Lists — tight */
ul, ol {
  margin: 0;
  padding-left: 16px;
}

li {
  margin: 0;
}

/* Text emphasis */
b, strong { font-weight: bold; }
i, em { font-style: italic; }
u { text-decoration: underline; }

/* Links */
a {
  text-decoration: underline;
}

/* Code */
code {
  font-family: monospace;
  background-color: #eee;
  padding: 1px 3px;
  font-size: 13px;
}

/* Code block */
pre {
  font-family: monospace;
  background-color: #eee;
  padding: 6px;
  margin: 0;
  white-space: pre-wrap;
  font-size: 13px;
}
`;

  const editor = useEditorBridge({
    autofocus: false,
    avoidIosKeyboard: true,
    editable: true,
    initialContent: initialContent,
    bridgeExtensions: [
      ...TenTapStartKit,
      CodeBridge.configureCSS(customCodeBlockCSS),
      PlaceholderBridge.configureExtension({
        placeholder: placeholder ?? "Type something...",
      }),
      LinkBridge.configureExtension({}),
    ],
    onChange() {
      const provideContnet = async () => {
        const content = await editor.getHTML();

        onChangeValue(content);
      };

      provideContnet();
    },
  });

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          height: richTextHeight ?? "100%",
          marginHorizontal: margin ?? undefined,
        }}
      >
        <RichText editor={editor} />
      </View>
      <KeyboardAvoidingView
        keyboardVerticalOffset={keyboadVerticalOffset ?? 98}
        behavior="padding"
        style={{ flex: 1, position: "absolute", width: "100%", bottom: 0 }}
      >
        <Toolbar editor={editor} shouldHideDisabledToolbarItems={false} />
      </KeyboardAvoidingView>
    </View>
  );
}

export default CustomRichTextEditor;
