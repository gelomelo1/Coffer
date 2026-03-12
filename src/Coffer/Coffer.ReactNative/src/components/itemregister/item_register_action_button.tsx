import { highImageResize } from "@/src/const/image_resize_config";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { pickImage } from "@/src/utils/data_access_utils";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { FAB, Portal } from "react-native-paper";
import CustomImageResize from "../custom_ui/custom_image_resize";
import CustomOverlayMessage from "../custom_ui/custom_overlay_message";
import ItemRegisterImagePickerOverlay from "./item_register_image_picker_overlay";
import ItemRegisterOverlay from "./item_register_overlay";

interface ItemRegisterActionButtonProps {
  collectionType: CollectionType;
  collection: Collection;
}

function ItemRegisterActionButton({
  collectionType,
  collection,
}: ItemRegisterActionButtonProps) {
  const { navigationMode } = useNavigationModeStore();

  const [open, setOpen] = useState(false);

  const [isImagePickerLoading, setIsImagePickerLoading] = useState<
    "Gallery" | "Camera" | null
  >(null);

  const [isItemRegisterOverlayOpen, setIsItemRegisterOverlayOpen] =
    useState(false);

  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [isPermissionWarningOverlayOpen, setIsPermissionWarningOverlayOpen] =
    useState(false);

  const handleGalleryImagePick = async () => {
    setIsImagePickerLoading("Gallery");

    const result = await pickImage("gallery");

    switch (result.status) {
      case "success":
        const image = result.assets[0];
        setAsset(image);
        break;
      case "cancel":
        setIsImagePickerLoading(null);
        setAsset(null);
        break;
      case "error":
        console.log("Error occured during gallery open", result.error);
        setIsImagePickerLoading(null);
        setAsset(null);
        break;
      case "permission_denied":
        setIsPermissionWarningOverlayOpen(true);
        setAsset(null);
        break;
    }
  };

  const handleCameraImagePick = async () => {
    setIsImagePickerLoading("Camera");

    const result = await pickImage("camera");

    switch (result.status) {
      case "success":
        const image = result.assets[0];
        setAsset(image);
        break;
      case "cancel":
        setIsImagePickerLoading(null);
        setAsset(null);
        break;
      case "error":
        console.log("Error occured during camera open", result.error);
        setIsImagePickerLoading(null);
        setAsset(null);
        break;
      case "permission_denied":
        setIsPermissionWarningOverlayOpen(true);
        setAsset(null);
        break;
    }
  };

  const handlePermissionWarningOverlayClose = () => {
    setIsImagePickerLoading(null);
    setIsPermissionWarningOverlayOpen(false);
  };

  const handleResizeCompleted = () => {
    setIsImagePickerLoading(null);
    setIsItemRegisterOverlayOpen(true);
  };

  return (
    <>
      <Portal>
        <FAB.Group
          open={open}
          visible
          icon={open ? "close" : "plus"}
          fabStyle={{
            backgroundColor: customTheme.colors.primary,
            borderWidth: 2,
            borderColor: customTheme.colors.secondary,
          }}
          style={{
            position: "absolute",
            paddingBottom: navigationMode.navigationBarHeight + 40,
            paddingRight: 0,
            marginRight: -8,
          }}
          color={customTheme.colors.secondary}
          actions={[
            {
              icon: "camera",
              label: "Camera",
              onPress: async () => await handleCameraImagePick(),
              style: {
                backgroundColor: customTheme.colors.primary,
                borderWidth: 2,
                borderColor: customTheme.colors.secondary,
              },
              color: customTheme.colors.secondary,
            },
            {
              icon: "image",
              label: "Gallery",
              onPress: async () => await handleGalleryImagePick(),
              style: {
                backgroundColor: customTheme.colors.primary,
                borderWidth: 2,
                borderColor: customTheme.colors.secondary,
              },
              color: customTheme.colors.secondary,
            },
          ]}
          onStateChange={() => setOpen(!open)}
        />
      </Portal>
      <ItemRegisterOverlay
        collectionType={collectionType}
        collection={collection}
        isItemRegisterOverlayOpen={{
          value: isItemRegisterOverlayOpen,
          set: setIsItemRegisterOverlayOpen,
        }}
        asset={{
          value: asset,
          set: setAsset,
        }}
      />
      <ItemRegisterImagePickerOverlay
        isImagePickerLoading={isImagePickerLoading}
      />
      <CustomOverlayMessage
        isVisible={isPermissionWarningOverlayOpen}
        onClose={handlePermissionWarningOverlayClose}
        overlayTitle={
          isImagePickerLoading === "Gallery"
            ? "Gallery Permission"
            : "Camera Permission"
        }
        message={
          isImagePickerLoading === "Gallery"
            ? "Gallery permission is required to add items and enable the item duplication detection feature. Please allow access to continue."
            : "Camera permission is required to add items and enable the item duplication detection feature. Please allow access to continue."
        }
      />
      {asset ? (
        <CustomImageResize
          width={highImageResize.width}
          compress={highImageResize.compress}
          asset={asset}
          setAsset={setAsset}
          onComplete={handleResizeCompleted}
        />
      ) : null}
    </>
  );
}

export default ItemRegisterActionButton;
