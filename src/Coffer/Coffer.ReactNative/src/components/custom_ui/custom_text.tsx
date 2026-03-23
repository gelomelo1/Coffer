import { customTheme } from "@/src/theme/theme";
import { useState } from "react";
import { StyleSheet, Text, TextStyle, View } from "react-native";
import { TextProps } from "react-native-elements";

interface CustomTextProps extends TextProps {
  foldable?: boolean;
  maxLines?: number;
}

const defaultStyle: TextStyle = {
  color: customTheme.colors.primary,
  fontSize: 16,
  fontFamily: "VendSans",
};

const CustomText: React.FC<CustomTextProps> = ({
  style,
  children,
  foldable = false,
  maxLines = 3,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const handleOpen = () => setIsOpen(true);

  if (!foldable) {
    return (
      <Text style={[defaultStyle, style]} {...props}>
        {children}
      </Text>
    );
  }

  return (
    <View>
      {/* Offscreen text for measuring overflow */}
      {foldable && (
        <Text
          style={[defaultStyle, style, styles.offscreenText]}
          onTextLayout={(e) => {
            const lines = e.nativeEvent.lines.length;
            if (lines > maxLines && !isOverflowing) {
              setIsOverflowing(true);
            }
          }}
        >
          {children}
        </Text>
      )}

      {/* Visible text */}
      <Text
        style={[defaultStyle, style]}
        numberOfLines={foldable && !isOpen ? maxLines : undefined}
        ellipsizeMode={foldable ? "tail" : "clip"}
        {...props}
      >
        {children}
      </Text>

      {/* "Read further" */}
      {foldable && !isOpen && isOverflowing && (
        <Text
          style={[defaultStyle, style, { fontFamily: "VendSansBold" }]}
          onPress={handleOpen}
        >
          Read further
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  offscreenText: {
    position: "absolute",
    opacity: 0,
    left: 0,
    top: 0,
    width: "100%",
  },
});

export default CustomText;
