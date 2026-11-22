import { ROUTES } from "@/src/const/navigation_params";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { usePathname } from "expo-router";
import { spacing } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Portal } from "react-native-paper";
import { RetroFab } from "../custom_ui/fab";
import { homeChromeProgress, useHomeChromeHidden } from "@/src/hooks/home_chrome";
import { TAB_BAR_CONTENT_HEIGHT } from "../collections/tabs/layout/collection_tabs_custom_layout";
import ItemRegisterCollectionSelectOverlay from "./item_register_collection_select_overlay";
import { useUploadFlow } from "./upload_flow";

/** The tabs' add button: choose a collection, then take photos or pick several from the gallery. */
function ItemRegisterActionButtonTabs() {
  const { navigationMode } = useNavigationModeStore();
  const { t } = useTranslation();
  const chromeHidden = useHomeChromeHidden();
  // The Community tab's tiles fill the whole screen: the button would cover one, so it isn't shown there.
  const onCommunity = usePathname() === `/${ROUTES.TABS.COMMUNITY}`;
  const fabBottom = navigationMode.navigationBarHeight + TAB_BAR_CONTENT_HEIGHT + spacing.md;
  const upload = useUploadFlow();

  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

  const startFrom = (source: "camera" | "gallery") => {
    setIsSelectOpen(false);
    if (selectedCollection) void upload.start(selectedCollection, source);
  };

  return (
    <>
      <Portal>
        {onCommunity ? null : (
          <RetroFab
            icon="plus"
            label={t("navigation:fab.addItem")}
            onPress={() => {
              setSelectedCollection(null);
              setIsSelectOpen(true);
            }}
            bottom={fabBottom}
            // Fades out with a slight downward float alongside the Home tab's hide-on-scroll chrome (progress stays 0 on
            // the other tabs).
            translateY={homeChromeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, spacing.lg] })}
            opacity={homeChromeProgress.interpolate({ inputRange: [0, 0.8], outputRange: [1, 0], extrapolate: "clamp" })}
            hidden={chromeHidden}
          />
        )}
      </Portal>
      <ItemRegisterCollectionSelectOverlay
        isItemRegisterCollectionSelectOverlayOpen={{ value: isSelectOpen, set: setIsSelectOpen }}
        selectedCollection={{ value: selectedCollection, set: setSelectedCollection }}
        onGalleryPick={() => startFrom("gallery")}
        onPhotoPick={() => startFrom("camera")}
      />
      {upload.node}
    </>
  );
}

export default ItemRegisterActionButtonTabs;
