import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { FAB, Portal } from "react-native-paper";
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

  const handleGalleryImagePick = async () => {
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
        isImagePickerLoading={isImagePickerLoading}
        isItemRegisterOverlayOpen={{
          value: isItemRegisterOverlayOpen,
          set: setIsItemRegisterOverlayOpen,
        }}
        asset={asset}
      />
    </>
  );
}

export default ItemRegisterActionButton;
