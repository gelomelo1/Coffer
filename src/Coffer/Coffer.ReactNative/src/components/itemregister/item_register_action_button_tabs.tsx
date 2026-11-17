import { highImageResize } from "@/src/const/image_resize_config";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { spacing } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import { pickImage } from "@/src/utils/data_access_utils";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Portal } from "react-native-paper";
import { RetroFab } from "../custom_ui/fab";
import { homeChromeProgress, useHomeChromeHidden } from "@/src/hooks/home_chrome";
import { TAB_BAR_CONTENT_HEIGHT } from "../collections/tabs/layout/collection_tabs_custom_layout";
import CustomImageResize from "../custom_ui/custom_image_resize";
import CustomOverlayMessage from "../custom_ui/custom_overlay_message";
import ItemRegisterCollectionSelectOverlay from "./item_register_collection_select_overlay";
import ItemRegisterImagePickerOverlay from "./item_register_image_picker_overlay";
import ItemRegisterOverlay from "./item_register_overlay";

function ItemRegisterActionButtonTabs() {
  const { collectionTypes } = useCollectionTypeStore();
  const { navigationMode } = useNavigationModeStore();
  const { t } = useTranslation();
  const chromeHidden = useHomeChromeHidden();
  const fabBottom = navigationMode.navigationBarHeight + TAB_BAR_CONTENT_HEIGHT + spacing.md;

  const [isImagePickerLoading, setIsImagePickerLoading] = useState<
    "Gallery" | "Camera" | null
  >(null);

  const [isItemRegisterOverlayOpen, setIsItemRegisterOverlayOpen] =
    useState(false);

  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [
    isItemRegisterCollectionSelectOverlayOpen,
    setIsItemRegisterCollectionSelectOverlayOpen,
  ] = useState(false);

  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);

  const [isPermissionWarningOverlayOpen, setIsPermissionWarningOverlayOpen] =
    useState(false);

  const handleGalleryImagePick = async () => {
    setIsItemRegisterCollectionSelectOverlayOpen(false);
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
    setIsItemRegisterCollectionSelectOverlayOpen(false);
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

  const handlePress = () => {
    setIsItemRegisterCollectionSelectOverlayOpen(true);
    setSelectedCollection(null);
  };

  const handleResizeCompleted = () => {
    setIsImagePickerLoading(null);
    setIsItemRegisterOverlayOpen(true);
  };

  return (
    <>
      <Portal>
        <RetroFab
          icon="plus"
          label={t("navigation:fab.addItem")}
          onPress={handlePress}
          bottom={fabBottom}
          // Fades out with a slight downward float alongside the Home tab's hide-on-scroll chrome (progress stays 0 on
          // the other tabs).
          translateY={homeChromeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.lg] })}
          opacity={homeChromeProgress.interpolate({ inputRange: [0, 0.8], outputRange: [1, 0], extrapolate: "clamp" })}
          hidden={chromeHidden}
        />
      </Portal>
      {selectedCollection ? (
        <ItemRegisterOverlay
          collectionType={
            collectionTypes.find(
              (collectionType) =>
                collectionType.id === selectedCollection.collectionTypeId,
            )!
          }
          collection={selectedCollection}
          isItemRegisterOverlayOpen={{
            value: isItemRegisterOverlayOpen,
            set: setIsItemRegisterOverlayOpen,
          }}
          asset={{
            value: asset,
            set: setAsset,
          }}
        />
      ) : null}
      <ItemRegisterCollectionSelectOverlay
        isItemRegisterCollectionSelectOverlayOpen={{
          value: isItemRegisterCollectionSelectOverlayOpen,
          set: setIsItemRegisterCollectionSelectOverlayOpen,
        }}
        selectedCollection={{
          value: selectedCollection,
          set: setSelectedCollection,
        }}
        onGalleryPick={handleGalleryImagePick}
        onPhotoPick={handleCameraImagePick}
      />
      <ItemRegisterImagePickerOverlay
        isImagePickerLoading={isImagePickerLoading}
      />
      <CustomOverlayMessage
        isVisible={isPermissionWarningOverlayOpen}
        onClose={handlePermissionWarningOverlayClose}
        overlayTitle={
          isImagePickerLoading === "Gallery"
            ? t("items:permissions.galleryTitle")
            : t("items:permissions.cameraTitle")
        }
        message={
          isImagePickerLoading === "Gallery"
            ? t("items:permissions.galleryText")
            : t("items:permissions.cameraText")
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

export default ItemRegisterActionButtonTabs;
