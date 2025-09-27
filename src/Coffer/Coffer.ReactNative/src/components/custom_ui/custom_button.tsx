import { customTheme } from "@/src/theme/theme";
import { StyleSheet, TextStyle, View, ViewStyle } from "react-native";
import { Button, ButtonProps } from "react-native-elements";

const defaultStyles = {
  containerStyle: {
    width: "100%",
  } as ViewStyle,
  buttonStyle: {
    width: "100%",
    backgroundColor: customTheme.colors.primary,
    borderWidth: 2,
    borderColor: customTheme.colors.secondary,
    borderRadius: 0,
    boxShadow: `2px 2px ${customTheme.colors.secondary}`,
  } as unknown as ViewStyle,
  disabledStyle: {
    backgroundColor: customTheme.colors.primary,
    borderWidth: 0,
    shadowOpacity: 0,
  } as ViewStyle,
  titleStyle: {
    color: customTheme.colors.secondary,
    fontFamily: "VendSansBold",
  } as TextStyle,
  disabledTitleStyle: {
    color: customTheme.colors.secondary,
    fontFamily: "VendSansBold",
  } as TextStyle,
};

const CustomButton: React.FC<ButtonProps> = ({
  containerStyle,
  buttonStyle,
  disabledStyle,
  titleStyle,
  disabledTitleStyle,
  disabled,
  ...rest
}) => {
  const isDisabled = disabled;

  return (
    <View
      style={[
        {
          position: "relative",
          alignSelf: "center",
        },
        defaultStyles.containerStyle,
        containerStyle,
      ]}
    >
      <Button
        {...rest}
        disabled={isDisabled}
        buttonStyle={[defaultStyles.buttonStyle, buttonStyle]}
        disabledStyle={[defaultStyles.disabledStyle, disabledStyle]}
        titleStyle={[defaultStyles.titleStyle, titleStyle]}
        disabledTitleStyle={[
          defaultStyles.disabledTitleStyle,
          disabledTitleStyle,
        ]}
        raised
      />

      {/* Black overlay when disabled */}
      {isDisabled && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: customTheme.colors.disabledOverlay,
            },
          ]}
        />
      )}
    </View>
  );
};

export default CustomButton;
