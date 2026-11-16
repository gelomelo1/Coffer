import { borders, colors, spacing, typography } from "@/src/theme/theme";
import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

interface DialogProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** Tapping outside closes the dialog (default true). */
  dismissable?: boolean;
}

/** Centered square dialog on a dimmed scrim. Android back closes it. */
export function Dialog({ visible, onClose, title, children, actions, dismissable = true }: DialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.lg }}>
        <Pressable
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay }}
          onPress={dismissable ? onClose : undefined}
          accessible={false}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "85%",
            backgroundColor: colors.bg,
            borderWidth: borders.width,
            borderColor: colors.border,
            boxShadow: `4px 4px 0px ${colors.primary}`,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
            {title}
          </Text>
          {children ? <ScrollView style={{ flexGrow: 0 }}>{children}</ScrollView> : null}
          {actions ? <View style={{ gap: spacing.sm }}>{actions}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export default Dialog;
