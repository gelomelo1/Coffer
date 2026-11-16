import { AppHeader, HeaderIconButton, headerTexts } from "@/src/components/layout/app_header";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useNavigationModeStore } from "@/src/hooks/navigation_mode_store";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors } from "@/src/theme/theme";
import { NavigationParams } from "@/src/types/helpers/navigation";
import { parseParams } from "@/src/utils/navigation_utils";
import { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { navigate } from "expo-router/build/global-state/routing";
import { useTranslation } from "react-i18next";

/** Height of the tab bar content row, without the system navigation bar inset. */
export const TAB_BAR_CONTENT_HEIGHT = 64;

function TabsHeader({ params }: { params: NavigationParams | undefined }) {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const { screenTitle } = headerTexts(params, t);
  return (
    <AppHeader
      variant="plain"
      showBack={false}
      title={user?.name ? t("navigation:header.hello", { name: user.name }) : t("common:appName")}
      subtitle={screenTitle}
      right={
        <>
          <HeaderIconButton icon="help-outline" label={t("navigation:header.help")} onPress={() => console.log("Help Pressed")} />
          <HeaderIconButton
            icon="settings"
            label={t("navigation:header.settings")}
            onPress={() => navigate({ pathname: ROUTES.SETTINGS.ROOT, params: pageParams.settings })}
          />
        </>
      }
    />
  );
}

function CollectionTabsCustomLayout(route: RouteProp<ParamListBase, string>): BottomTabNavigationOptions {
  const { navigationMode } = useNavigationModeStore();
  const params = parseParams(route);

  return {
    tabBarStyle: {
      height: navigationMode.navigationBarHeight + TAB_BAR_CONTENT_HEIGHT,
      paddingBottom: navigationMode.navigationBarHeight,
      paddingTop: 0,
      backgroundColor: colors.bg,
      borderTopWidth: borders.width,
      borderTopColor: colors.border,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarItemStyle: { paddingVertical: 0 },
    tabBarIconStyle: { width: "100%", height: "100%" },
    animation: "fade",
    tabBarShowLabel: false,
    headerShown: true,
    header: () => <TabsHeader params={params} />,
  };
}

export default CollectionTabsCustomLayout;
