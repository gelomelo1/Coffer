import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { spacing } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Portal } from "react-native-paper";
import { RetroFabGroup } from "../custom_ui/fab";
import { useUploadFlow } from "./upload_flow";

interface ItemRegisterActionButtonProps {
  collectionType: CollectionType;
  collection: Collection;
}

/** The collection screen's add button: take photos or pick several from the gallery; the caps found wait for review. */
function ItemRegisterActionButton({ collection }: ItemRegisterActionButtonProps) {
  const { navigationMode } = useNavigationModeStore();
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const upload = useUploadFlow();

  return (
    <>
      <Portal>
        <RetroFabGroup
          open={open}
          onToggle={() => setOpen(!open)}
          bottom={navigationMode.navigationBarHeight + spacing.md}
          openLabel={t("navigation:fab.addItem")}
          closeLabel={t("accessibility:close")}
          actions={[
            { icon: "camera", label: t("items:upload.takePhotos"), onPress: () => void upload.start(collection, "camera") },
            { icon: "image-multiple", label: t("items:upload.fromGallery"), onPress: () => void upload.start(collection, "gallery") },
          ]}
        />
      </Portal>
      {upload.node}
    </>
  );
}

export default ItemRegisterActionButton;
