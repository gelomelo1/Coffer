import { customTheme } from "@/src/theme/theme";
import { TextStyle, View, ViewStyle } from "react-native";
import { Input, InputProps } from "react-native-elements";

const defaultStyles = {
  inputContainerStyle: (disabled?: boolean): ViewStyle =>
    ({
      width: "100%",
      backgroundColor: customTheme.colors.secondary,
      borderColor: customTheme.colors.primary,
      borderWidth: disabled ? 0 : 2,
      paddingHorizontal: 5,
      boxShadow: disabled ? "none" : `2px 2px ${customTheme.colors.primary}`,
    }) as ViewStyle,
  containerStyle: {
    minHeight: 70,
    maxHeight: 150,
    paddingHorizontal: 0,
    paddingVertical: 0,
  } as ViewStyle,
  inputStyle: {
    color: customTheme.colors.primary,
    fontFamily: "VendSans",
  } as TextStyle,
  labelStyle: {
    color: customTheme.colors.primary,
    fontFamily: "VendSansBold",
  } as TextStyle,
  placeholderTextColor: customTheme.colors.primary,
};

const CustomTextInput: React.FC<InputProps> = ({
  inputContainerStyle,
  containerStyle,
  inputStyle,
  labelStyle,
  placeholderTextColor,
  disabled,
  style,
  keyboardType = "default",
  multiline = false,
  ...rest
}) => {
  const isDisabled = disabled ?? false;

  return (
    <View
      style={[
        {
          position: "relative",
          alignSelf: "center",
        },
        style as ViewStyle,
      ]}
    >
      <Input
        {...rest}
        disabled={isDisabled}
        containerStyle={[defaultStyles.containerStyle, containerStyle]}
        inputContainerStyle={[
          defaultStyles.inputContainerStyle(isDisabled),
          inputContainerStyle,
        ]}
        inputStyle={[defaultStyles.inputStyle, inputStyle]}
        labelStyle={[defaultStyles.labelStyle, labelStyle]}
        placeholderTextColor={
          placeholderTextColor || defaultStyles.placeholderTextColor
        }
        disabledInputStyle={[defaultStyles.inputStyle, inputStyle]}
        keyboardType={keyboardType}
        multiline={multiline}
      />
      {disabled && (
        <View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 22,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: customTheme.colors.disabledOverlay,
            },
          ]}
        />
      )}
    </View>
  );
};

export default CustomTextInput;
