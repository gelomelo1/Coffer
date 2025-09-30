import { customTheme } from "@/src/theme/theme";
import { ReactNode } from "react";
import { ScrollView, ViewStyle } from "react-native";

interface RootViewProps {
  children: ReactNode;
  color?: string;
  style?: ViewStyle;
}

function RootView({ children, color, style }: RootViewProps) {
  return (
    <ScrollView
      style={[
        {
          flex: 1,
          padding: 10,
          backgroundColor: customTheme.colors.background,
          borderWidth: 2,
          borderColor: color ?? customTheme.colors.primary,
          boxShadow: `inset 0 4px 4px -4px ${customTheme.colors.disabledOverlay}, inset 0 -4px 4px -4px ${customTheme.colors.disabledOverlay}`,
        },
        style,
      ]}
    >
      {children}
    </ScrollView>
  );
}

export default RootView;
