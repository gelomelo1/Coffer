import { borders, colors, fonts, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";
import { ToastConfig, ToastConfigParams } from "react-native-toast-message";

const kinds = {
  success: { icon: "check-circle", bar: colors.success },
  error: { icon: "error", bar: colors.danger },
  info: { icon: "info", bar: colors.secondary },
} as const;

function RetroToast({ text1, text2, kind }: ToastConfigParams<unknown> & { kind: keyof typeof kinds }) {
  const k = kinds[kind];
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={{
        width: "92%",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.bg,
        borderWidth: borders.width,
        borderColor: colors.primary,
        borderLeftWidth: 6,
        borderLeftColor: k.bar,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        boxShadow: `3px 3px 0px ${colors.primary}`,
      }}
    >
      <MaterialIcons name={k.icon} size={24} color={k.bar} />
      <View style={{ flex: 1, gap: 2 }}>
        {text1 ? <Text style={[typography.bodyStrong, { color: colors.text }]}>{text1}</Text> : null}
        {text2 ? <Text style={{ color: colors.text, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 }}>{text2}</Text> : null}
      </View>
    </View>
  );
}

export const toastConfig: ToastConfig = {
  success: (p) => <RetroToast {...p} kind="success" />,
  error: (p) => <RetroToast {...p} kind="error" />,
  info: (p) => <RetroToast {...p} kind="info" />,
};
