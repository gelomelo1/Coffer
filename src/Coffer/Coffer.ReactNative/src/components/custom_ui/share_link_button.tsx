import CustomIconButton from "@/src/components/custom_ui/custom_icon_button";
import { colors } from "@/src/theme/theme";
import { AppLinkKind, appLinkFor } from "@/src/utils/app_links";
import { useTranslation } from "react-i18next";
import { Share, StyleProp, ViewStyle } from "react-native";

/**
 * "Copy app link": opens the system share sheet with this page's in-app link (Android's sheet has Copy), for pasting
 * into a news post. Plain React Native Share, no native module.
 */
export function ShareLinkButton({ kind, id, color = colors.text, style }: { kind: AppLinkKind; id?: string | null; color?: string; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  if (!id) return null;
  const share = () => {
    Share.share({ message: appLinkFor(kind, id) }).catch(() => {});
  };
  return (
    <CustomIconButton
      variant="plain"
      iconName="share-variant"
      iconType="materialcommunityicons"
      color={color}
      accessibilityLabel={t("common:actions.shareLink")}
      onPress={share}
      style={style}
    />
  );
}
