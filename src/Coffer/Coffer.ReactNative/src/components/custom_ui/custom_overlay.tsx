import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { customTheme } from "@/src/theme/theme";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomText from "./custom_text";

interface CustomOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  overlayTitle: string;
  children: React.ReactNode;
  footerContent?: React.ReactNode;
}

function CustomOverlay({
  isVisible,
  onClose,
  overlayTitle,
  children,
  footerContent,
}: CustomOverlayProps) {
  const { navigationMode } = useNavigationModeStore();

  return (
    <Overlay
      isVisible={isVisible}
      onBackdropPress={onClose}
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
        margin: 0,
        padding: 0,
      }}
      fullScreen
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View>
          <View
            style={{
              position: "relative",
              backgroundColor: customTheme.colors.background,

              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: customTheme.colors.primary,
              paddingBottom: 10,
              paddingHorizontal: 10,
              zIndex: 1,
              boxShadow: `0px 2px 2px ${customTheme.colors.primary}`,
            }}
          >
            <CustomText
              numberOfLines={1}
              style={{
                fontSize: 20,
                fontWeight: "bold",
              }}
            >
              {overlayTitle}
            </CustomText>

            <TouchableOpacity onPress={onClose}>
              <Text
                style={{
                  color: customTheme.colors.primary,
                  fontSize: 24,
                  fontWeight: "bold",
                }}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1 }}>{children}</View>
        {footerContent ? (
          <View
            style={{
              height: 80,
              backgroundColor: customTheme.colors.background,
              borderTopWidth: 2,
              borderLeftWidth: 2,
              borderRightWidth: 2,
              borderBottomColor: customTheme.colors.primary,
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              justifyContent: "center",
              alignItems: "center",
              boxShadow: `0px -2px 2px ${customTheme.colors.primary}`,
            }}
          >
            {footerContent}
          </View>
        ) : null}
      </SafeAreaView>
    </Overlay>
  );
}

export default CustomOverlay;
