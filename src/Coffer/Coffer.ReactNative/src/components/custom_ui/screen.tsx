import { colors, spacing } from "@/src/theme/theme";
import React from "react";
import { ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Safe-area aware page container with the standard 16dp gutter. */
export function Screen({ children, scroll = false, edges = ["bottom"], padded = true, style, contentStyle }: ScreenProps) {
  const pad = padded ? { padding: spacing.md } : null;
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, { gap: spacing.md, paddingBottom: spacing.xl }, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export default Screen;
