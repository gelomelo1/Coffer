import { customTheme } from "@/src/theme/theme";
import { TouchableOpacity, ViewStyle } from "react-native";
import { Icon } from "react-native-elements";
import CustomText from "./custom_text";

interface CustomIconButtonProps {
  iconName: string;
  iconType: string;
  onPress: () => void;
  title?: string;
  color?: string;
  reverseColor?: string;
  disabled?: boolean;
  size?: number;
  style?: ViewStyle;
}

function CustomIconButton({
  iconName,
  iconType,
  title,
  onPress,
  color,
  reverseColor,
  disabled = false,
  size,
  style,
}: CustomIconButtonProps) {
  return (
    <TouchableOpacity
      style={{ ...style, justifyContent: "center" }}
      onPress={onPress}
      disabled={disabled}
    >
      <Icon
        name={iconName}
        type={iconType}
        color={color ?? customTheme.colors.primary}
        reverse
        reverseColor={reverseColor ?? customTheme.colors.secondary}
        disabled={disabled}
        containerStyle={{ margin: 0 }}
        size={size}
      />
      {title ? (
        <CustomText style={{ fontSize: 14, textAlign: "center" }}>
          {title}
        </CustomText>
      ) : null}
    </TouchableOpacity>
  );
}

export default CustomIconButton;
