import { customTheme } from "@/src/theme/theme";
import {
  ActivityIndicatorProps,
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Button, ButtonProps } from "react-native-elements";

const defaultStyles = {
  containerStyle: (disabled: boolean): ViewStyle => ({
    borderWidth: disabled ? 0 : 2,
    borderColor: customTheme.colors.secondary,
    borderRadius: 0,
    boxShadow: disabled ? "none" : `1px 1px ${customTheme.colors.secondary}`,
  }),
  innerContainerStyle: {
    borderRadius: 0,
  } as ViewStyle,
  disabledStyle: {
    width: "100%",
    backgroundColor: customTheme.colors.primary,
    borderRadius: 0,
  } as ViewStyle,
  disabledTitleStyle: {
    color: customTheme.colors.secondary,
    fontFamily: "VendSansBold",
  } as TextStyle,
  loadingProps: {
    color: customTheme.colors.secondary,
  } as ActivityIndicatorProps,
};

const CustomButton: React.FC<ButtonProps> = ({
  containerStyle,
  disabledStyle,
  titleStyle,
  disabledTitleStyle,
  loadingProps,
  disabled,
  onPress,
  ...rest
}) => {
  const isDisabled = disabled ?? false;

  return (
    <TouchableOpacity
      style={[
        {
          position: "relative",
          alignSelf: "stretch",
        },
        defaultStyles.containerStyle(isDisabled),
        containerStyle,
      ]}
      disabled={isDisabled}
      onPress={onPress}
    >
      <Button
        {...rest}
        disabled={true}
        onPress={(e) => e.preventDefault()}
        containerStyle={defaultStyles.innerContainerStyle}
        disabledStyle={[defaultStyles.disabledStyle]}
        titleStyle={[defaultStyles.disabledTitleStyle, titleStyle]}
        disabledTitleStyle={[
          defaultStyles.disabledTitleStyle,
          disabledTitleStyle,
        ]}
        loadingProps={{ ...defaultStyles.loadingProps, ...loadingProps }}
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
    </TouchableOpacity>
  );
};

export default CustomButton;
