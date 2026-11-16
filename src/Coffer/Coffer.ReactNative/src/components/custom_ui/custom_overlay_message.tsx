import { colors, typography } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import CustomButton from "./custom_button";
import Dialog from "./dialog";

interface CustomOverlayMessageProps {
  isVisible: boolean;
  onClose: () => void;
  overlayTitle: string;
  message: string;
}

/** Informational dialog with a single OK action. */
function CustomOverlayMessage({ isVisible, onClose, overlayTitle, message }: CustomOverlayMessageProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      visible={isVisible}
      onClose={onClose}
      title={overlayTitle}
      actions={<CustomButton title={t("common:actions.ok")} onPress={onClose} />}
    >
      <Text style={[typography.body, { color: colors.text }]}>{message}</Text>
    </Dialog>
  );
}

export default CustomOverlayMessage;
