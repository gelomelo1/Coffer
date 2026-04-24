import { customTheme } from "@/src/theme/theme";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import RenderHTML from "react-native-render-html";
import CustomText from "./custom_text";

interface CustomHTMLViewProps {
  content: string;
  foldable?: boolean;
}

function CustomHTMLView({ content, foldable = false }: CustomHTMLViewProps) {
  const [contentHeight, setContentHeight] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const lineHeight = 18;

  const maxHeight = 3 * lineHeight;

  const isOverflowing = contentHeight > maxHeight;

  const handleOpen = () => {
    setIsOpen(true);
  };

  return (
    <View style={{ paddingHorizontal: 10 }}>
      <View
        style={{
          maxHeight: isOpen || !foldable ? undefined : maxHeight,
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

              // Headings — scaled relative to 14px, NO spacing
              h1: { fontSize: 20, fontWeight: "bold", marginBottom: 0 },
              h2: { fontSize: 18, fontWeight: "bold", marginBottom: 0 },
              h3: { fontSize: 16, fontWeight: "bold", marginBottom: 0 },
              h4: { fontSize: 15, fontWeight: "bold", marginBottom: 0 },
              h5: { fontSize: 14, fontWeight: "bold", marginBottom: 0 },
              h6: { fontSize: 13, fontWeight: "bold", marginBottom: 0 },

              // Paragraph — behaves like simple newline (no spacing)
              p: {
                marginTop: 0,
                marginBottom: 0,
                minHeight: 18,
              },

              // Lists — minimal spacing
              ul: {
                marginTop: 0,
                marginBottom: 0,
                paddingLeft: 16,
              },
              ol: {
                marginTop: 0,
                marginBottom: 0,
                paddingLeft: 16,
              },
              li: {
                marginTop: 0,
                marginBottom: 0,
              },

              // Links
              a: { textDecorationLine: "underline" },

              // Code
              code: {
                fontFamily: "monospace",
                backgroundColor: "#eee",
                paddingHorizontal: 3,
                paddingVertical: 1,
                fontSize: 13,
              },

              pre: {
                fontFamily: "monospace",
                backgroundColor: "#eee",
                padding: 6,
                marginTop: 0,
                marginBottom: 0,
                fontSize: 13,
              },
            }}
            classesStyles={{
              placeholder: {
                color: "grey",
                fontSize: 16,
              },
            }}
            source={{
              html: content,
            }}
          />
        </View>
      </View>
      {isOverflowing && !isOpen && foldable ? (
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
