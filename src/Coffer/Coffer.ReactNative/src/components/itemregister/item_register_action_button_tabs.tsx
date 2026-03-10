import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { FAB, Portal } from "react-native-paper";
import ItemRegisterCollectionSelectOverlay from "./item_register_collection_select_overlay";
import ItemRegisterOverlay from "./item_register_overlay";

function ItemRegisterActionButtonTabs() {
  const { collectionTypes } = useCollectionTypeStore();
  const { navigationMode } = useNavigationModeStore();

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

  const handleGalleryImagePick = async () => {
    setIsItemRegisterCollectionSelectOverlayOpen(false);
    setIsItemRegisterOverlayOpen(true);
    setIsImagePickerLoading("Gallery");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
    });
    setIsImagePickerLoading(null);
    if (result.canceled) {
      setIsItemRegisterOverlayOpen(false);
      return;
    }
    const asset = result.assets[0];
    setAsset(asset);
  };

  const handleCameraImagePick = async () => {
    setIsItemRegisterCollectionSelectOverlayOpen(false);
    setIsItemRegisterOverlayOpen(true);
    setIsImagePickerLoading("Camera");
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
    });
    setIsImagePickerLoading(null);
    if (result.canceled) {
      setIsItemRegisterOverlayOpen(false);
      return;
    }
    const asset = result.assets[0];
    setAsset(asset);
  };

  const handlePress = () => {
    setIsItemRegisterCollectionSelectOverlayOpen(true);
    setSelectedCollection(null);
  };

  return (
    <>
      <Portal>
        <FAB
          visible
          icon={"plus"}
          style={{
            backgroundColor: customTheme.colors.primary,
            borderWidth: 2,
            borderColor: customTheme.colors.secondary,
            position: "absolute",
            right: 8,
            bottom: navigationMode.navigationBarHeight + 60,
          }}
          color={customTheme.colors.secondary}
          onPress={handlePress}
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
          isImagePickerLoading={isImagePickerLoading}
          isItemRegisterOverlayOpen={{
            value: isItemRegisterOverlayOpen,
            set: setIsItemRegisterOverlayOpen,
          }}
          asset={asset}
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
    </>
  );
}

export default ItemRegisterActionButtonTabs;
