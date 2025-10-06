import { customTheme } from "@/src/theme/theme";
import { TouchableOpacity } from "react-native";
import { Icon } from "react-native-elements";
import CustomText from "./custom_text";

interface CustomIconButtonProps {
  iconName: string;
  iconType: string;
  title: string;
  onPress: () => void;
  color?: string;
  reverseColor?: string;
}

function CustomIconButton({
  iconName,
  iconType,
  title,
  onPress,
  color,
  reverseColor,
}: CustomIconButtonProps) {
  return (
    <TouchableOpacity style={{ justifyContent: "center" }} onPress={onPress}>
      <Icon
        name={iconName}
        type={iconType}
        color={color ?? customTheme.colors.primary}
        reverse
        reverseColor={reverseColor ?? customTheme.colors.secondary}
      />
      <CustomText style={{ fontSize: 14, textAlign: "center" }}>
        {title}
      </CustomText>
    </TouchableOpacity>
  );
}

export default CustomIconButton;
