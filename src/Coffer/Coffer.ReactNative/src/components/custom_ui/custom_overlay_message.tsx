import { customTheme } from "@/src/theme/theme";
import React from "react";
import { Overlay } from "react-native-elements";
import CustomText from "./custom_text";

interface CustomOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  overlayTitle: string;
  message: string;
}

function CustomOverlayMessage({
  isVisible,
  onClose,
  overlayTitle,
  message,
}: CustomOverlayProps) {
  return (
    <Overlay
      isVisible={isVisible}
      onBackdropPress={onClose}
      overlayStyle={{
        width: "90%",
        backgroundColor: customTheme.colors.background,
      }}
    >
      <CustomText style={{ fontSize: 18, fontFamily: "VendSansBold" }}>
        {overlayTitle}
      </CustomText>
      <CustomText>{message}</CustomText>
    </Overlay>
  );
}

export default CustomOverlayMessage;
