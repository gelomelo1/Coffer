import { colors } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import { Modal, View } from "react-native";
import { Loading } from "../custom_ui/loading";

interface ItemRegisterImagePickerOverlayProps {
  isImagePickerLoading: "Gallery" | "Camera" | null;
}

/** Blocking "opening camera / gallery…" screen while the system picker starts. */
function ItemRegisterImagePickerOverlay({ isImagePickerLoading }: ItemRegisterImagePickerOverlayProps) {
  const { t } = useTranslation();
  if (!isImagePickerLoading) return null;
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <Loading label={isImagePickerLoading === "Gallery" ? t("items:register.openingGallery") : t("items:register.openingCamera")} />
      </View>
    </Modal>
  );
}

export default ItemRegisterImagePickerOverlay;
