import { customTheme } from "@/src/theme/theme";
import { ViewStyle } from "react-native";

interface RootViewStyleProps {
  color?: string;
  style?: ViewStyle;
}

function rootViewStyle({ color, style }: RootViewStyleProps = {}): ViewStyle {
  return {
    flex: 1,
    padding: 10,
    backgroundColor: customTheme.colors.background,
    borderWidth: 2,
    borderColor: color ?? customTheme.colors.primary,
    boxShadow: `inset 0 4px 4px -4px ${customTheme.colors.disabledOverlay}, inset 0 -4px 4px -4px ${customTheme.colors.disabledOverlay}`,
    ...style,
  };
}

export default rootViewStyle;
