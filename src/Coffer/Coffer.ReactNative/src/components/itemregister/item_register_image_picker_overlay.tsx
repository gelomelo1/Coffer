import { customTheme } from "@/src/theme/theme";
import { View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomText from "../custom_ui/custom_text";
import { Loading } from "../custom_ui/loading";

interface ItemRegisterImagePickerOverlayProps {
  isImagePickerLoading: "Gallery" | "Camera" | null;
}

function ItemRegisterImagePickerOverlay({
  isImagePickerLoading,
}: ItemRegisterImagePickerOverlayProps) {
  return isImagePickerLoading ? (
    <Overlay
      isVisible={isImagePickerLoading !== null}
      fullScreen
      overlayStyle={{ backgroundColor: customTheme.colors.background }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CustomText>{isImagePickerLoading}</CustomText>
          <Loading />
        </View>
      </SafeAreaView>
    </Overlay>
  ) : null;
}

export default ItemRegisterImagePickerOverlay;
