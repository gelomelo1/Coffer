import { customTheme } from "@/src/theme/theme";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import RenderHTML from "react-native-render-html";
import CustomText from "./custom_text";

interface CustomHTMLViewProps {
  content: string;
}

function CustomHTMLView({ content }: CustomHTMLViewProps) {
  const [contentHeight, setContentHeight] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const lineHeight = 16.8;

  const maxHeight = 3 * lineHeight;

  const isOverflowing = contentHeight > maxHeight;

  const handleOpen = () => {
    setIsOpen(true);
  };

  return (
    <View style={{ paddingHorizontal: 10 }}>
      <View
        style={{
          maxHeight: isOpen ? undefined : maxHeight,
          overflow: "hidden",
        }}
      >
        <View onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}>
          <RenderHTML
            baseStyle={{
              color: customTheme.colors.primary,
              fontSize: 14,
              lineHeight: 18,
            }}
            tagsStyles={{
              // Text emphasis
              b: { fontWeight: "bold" },
              strong: { fontWeight: "bold" },
              i: { fontStyle: "italic" },
              em: { fontStyle: "italic" },
              u: { textDecorationLine: "underline" },

              // Headings (reduced spacing + slightly smaller)
              h1: { fontSize: 26, fontWeight: "bold", marginBottom: 4 },
              h2: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
              h3: { fontSize: 20, fontWeight: "bold", marginBottom: 3 },
              h4: { fontSize: 18, fontWeight: "bold", marginBottom: 3 },
              h5: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
              h6: { fontSize: 15, fontWeight: "bold", marginBottom: 2 },

              // Paragraph (tight)
              p: { marginBottom: 4 },

              // Lists (much tighter)
              ul: { marginVertical: 4 },
              ol: { marginVertical: 4 },
              li: { marginBottom: 2 },

              // Links
              a: { textDecorationLine: "underline" },

              // Code / pre (slightly tighter)
              code: {
                fontFamily: "monospace",
                backgroundColor: "#eee",
                padding: 1,
              },
              pre: {
                fontFamily: "monospace",
                backgroundColor: "#eee",
                padding: 6,
                marginBottom: 4,
              },
            }}
            source={{
              html: content,
            }}
          />
        </View>
      </View>
      {isOverflowing && !isOpen ? (
        <TouchableOpacity onPress={handleOpen}>
          <CustomText style={{ fontFamily: "VendSansBold" }}>
            <CustomText style={{ fontFamily: "VendSans" }}>...</CustomText>
            Read further
          </CustomText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default CustomHTMLView;
