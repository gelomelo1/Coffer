import { colors, spacing } from "@/src/theme/theme";
import { ViewStyle } from "react-native";

interface RootViewStyleProps {
  /** Kept for existing call sites; the redesign no longer frames screens with a colored border. */
  color?: string;
  style?: ViewStyle;
}

/** Standard page container style: cream background, 16dp gutter. */
function rootViewStyle({ style }: RootViewStyleProps = {}): ViewStyle {
  return {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.bg,
    ...style,
  };
}

export default rootViewStyle;
