import { customTheme } from "@/src/theme/theme";
import {
  CodeBridge,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
} from "@10play/tentap-editor";
import { KeyboardAvoidingView, View } from "react-native";

interface CustomRichTextEditorProps {
  initialContent: string;
  onChangeValue: (value: string) => void;
}

function CustomRichTextEditor({
  initialContent,
  onChangeValue,
}: CustomRichTextEditorProps) {
  const customCodeBlockCSS = `

  html, body {
    background-color: ${customTheme.colors.background};
    margin: 0;
    padding: 0;
    line-height: 1.3;
  }

  * {
    color: ${customTheme.colors.primary};
  }

  /* Text emphasis */
  b, strong { font-weight: bold; }
  i, em { font-style: italic; }
  u { text-decoration: underline; }

  /* Headings (reduced size + spacing) */
  h1 {
    font-size: 26px;
    font-weight: bold;
    margin-bottom: 4px;
  }

  h2 {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 4px;
  }

  h3 {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 3px;
  }

  h4 {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 3px;
  }

  h5 {
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 2px;
  }

  h6 {
    font-size: 15px;
    font-weight: bold;
    margin-bottom: 2px;
  }

  /* Paragraph (tight) */
  p {
    margin-bottom: 4px;
  }

  /* Lists (tight) */
  ul, ol {
    margin-top: 4px;
    margin-bottom: 4px;
    padding-left: 16px; /* keeps bullets aligned nicely */
  }

  li {
    margin-bottom: 2px;
  }

  /* Links */
  a {
    text-decoration: underline;
  }

  /* Code / pre (tightened) */
  code {
    font-family: monospace;
    background-color: #eee;
    padding: 1px 3px;
  }

  pre {
    font-family: monospace;
    background-color: #eee;
    padding: 6px;
    margin-bottom: 4px;
    overflow-x: auto;
  }
`;

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    editable: true,
    initialContent: initialContent,
    bridgeExtensions: [
      ...TenTapStartKit,
      CodeBridge.configureCSS(customCodeBlockCSS),
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
      <RichText editor={editor} />
      <KeyboardAvoidingView
        keyboardVerticalOffset={98}
        behavior="padding"
        style={{ position: "absolute", width: "100%", bottom: 0 }}
      >
        <Toolbar editor={editor} shouldHideDisabledToolbarItems={false} />
      </KeyboardAvoidingView>
    </View>
  );
}

export default CustomRichTextEditor;
