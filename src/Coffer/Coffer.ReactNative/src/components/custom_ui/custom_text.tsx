import { customTheme } from "@/src/theme/theme";
import React from "react";
import { Text, TextStyle } from "react-native";
import { TextProps } from "react-native-elements";

const defaultStyle: TextStyle = {
  color: customTheme.colors.primary,
  fontSize: 16,
  fontFamily: "VendSans",
};

const CustomText: React.FC<TextProps> = ({ style, children, ...props }) => {
  return (
    <Text style={[defaultStyle, style]} {...props}>
      {children}
    </Text>
  );
};

export default CustomText;
