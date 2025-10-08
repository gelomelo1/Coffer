import { endpoints } from "@/src/const/endpoints";
import { useCreateData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect } from "react";
import { TouchableOpacity, View } from "react-native";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomText from "../custom_ui/custom_text";
import { Loading } from "../custom_ui/loading";

interface ItemRegisterOverlayProps {
  isImagePickerLoading: "Gallery" | "Camera" | null;
  isItemRegisterOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  asset: ImagePicker.ImagePickerAsset | null;
}

function ItemRegisterOverlay({
  isImagePickerLoading,
  isItemRegisterOverlayOpen,
  asset,
}: ItemRegisterOverlayProps) {
  const {
    mutateAsync: doImageCheck,
    isPending: isDoImageCheckPending,
    isError: isDoImageCheckError,
    isSuccess: isDoImageCheckSuccess,
  } = useCreateData<FormData>(
    endpoints.itemsImageCheck,
    undefined,
    "Successfully checked",
    undefined,
    {
      "Content-Type": "multipart/form-data",
    }
  );

  useEffect(() => {
    if (!asset) return;

    const uploadImage = async () => {
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? "upload.jpg",
        type: asset.mimeType ?? "image/jpeg",
      } as any);

      await doImageCheck({
        value: formData,
      });
    };

    uploadImage();
  }, [asset]);

  return (
    <Overlay
      isVisible={isItemRegisterOverlayOpen.value}
      fullScreen
      overlayStyle={{ backgroundColor: customTheme.colors.background }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {isImagePickerLoading ? (
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
        ) : isDoImageCheckPending ? (
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <CustomText>{"Checking image"}</CustomText>
            <Loading />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Top-right Finish text */}
            <TouchableOpacity
              style={{ alignSelf: "flex-end", margin: 16 }}
              onPress={() => isItemRegisterOverlayOpen.set(false)}
            >
              <CustomText>Finish</CustomText>
            </TouchableOpacity>

            {/* Centered success/error message */}
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {isDoImageCheckError ? (
                <CustomText
                  style={{
                    color: "red",
                    fontSize: 20,
                  }}
                >
                  Error
                </CustomText>
              ) : isDoImageCheckSuccess ? (
                <CustomText
                  style={{
                    color: "green",
                    fontSize: 20,
                  }}
                >
                  Success
                </CustomText>
              ) : null}
            </View>
          </View>
        )}
      </SafeAreaView>
    </Overlay>
  );
}

export default ItemRegisterOverlay;
