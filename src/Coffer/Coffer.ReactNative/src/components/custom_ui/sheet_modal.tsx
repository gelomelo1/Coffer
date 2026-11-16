import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra element in the header, left of the close button. */
  headerRight?: React.ReactNode;
  bodyStyle?: StyleProp<ViewStyle>;
}

/**
 * Full-screen cream sheet: 56dp header (title + close), keyboard-aware body, optional footer bar above the
 * bottom inset. Android back and the iOS swipe-down both call onClose.
 */
function SheetModal({ visible, onClose, title, children, footer, headerRight, bodyStyle }: SheetModalProps) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "fullScreen" : undefined}
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* Modals render outside the app's provider tree on Android, so they need their own insets. */}
      <SafeAreaProvider>
        <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={{
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              paddingLeft: spacing.md,
              paddingRight: spacing.xxs,
              borderBottomWidth: borders.width,
              borderBottomColor: colors.border,
              backgroundColor: colors.bg,
            }}
          >
            <Text accessibilityRole="header" numberOfLines={2} style={[typography.headline, { color: colors.text, flex: 1 }]}>
              {title}
            </Text>
            {headerRight}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("accessibility:close")}
              style={({ pressed }) => ({
                width: sizes.touch,
                height: sizes.touch,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <MaterialIcons name="close" size={28} color={colors.text} />
            </Pressable>
          </View>

          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={[{ flex: 1 }, bodyStyle]}>{children}</View>
            {footer ? (
              <View
                style={{
                  borderTopWidth: borders.width,
                  borderTopColor: colors.border,
                  backgroundColor: colors.bg,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  gap: spacing.xs,
                }}
              >
                {footer}
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

export default SheetModal;
