import AnimatedTabIcon from "@/src/components/collections/tabs/layout/animated_tab_icon";
import CollectionTabsCustomLayout from "@/src/components/collections/tabs/layout/collection_tabs_custom_layout";
import ItemRegisterActionButtonTabs from "@/src/components/itemregister/item_register_action_button_tabs";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { Tabs, usePathname } from "expo-router";
import { navigate } from "expo-router/build/global-state/routing";
import React from "react";
import { useTranslation } from "react-i18next";
import { Provider as PaperProvider } from "react-native-paper";

function CollectionLayout() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <PaperProvider>
      <Tabs screenOptions={({ route }) => CollectionTabsCustomLayout(route)}>
        <Tabs.Screen
          name="index"
          options={() => {
            return {
              title: t("navigation:tabs.home"),
              tabBarIcon: () => (
                <AnimatedTabIcon
                  focused={pathname === `/${ROUTES.TABS.HOME}`}
                  title={t("navigation:tabs.home")}
                  icon={{ library: "fontawesome", name: "home" }}
                  navigate={() => {
                    navigate({
                      pathname: ROUTES.TABS.HOME,
                      params: pageParams.home,
                    });
                  }}
                />
              ),
            };
          }}
        />
        <Tabs.Screen
          name="collections"
          options={() => {
            return {
              title: t("navigation:tabs.collections"),
              tabBarIcon: () => (
                <AnimatedTabIcon
                  focused={pathname === `/${ROUTES.TABS.COLLECTIONS}`}
                  title={t("navigation:tabs.collections")}
                  icon={{
                    library: "materialcommunityicons",
                    name: "treasure-chest",
                  }}
                  navigate={() => {
                    navigate({
                      pathname: ROUTES.TABS.COLLECTIONS,
                      params: pageParams.collections,
                    });
                  }}
                />
              ),
            };
          }}
        />
        <Tabs.Screen
          name="myfollows"
          options={() => {
            return {
              title: t("navigation:tabs.myFollows"),
              tabBarIcon: () => (
                <AnimatedTabIcon
                  focused={pathname === `/${ROUTES.TABS.MYFOLLOWS}`}
                  title={t("navigation:tabs.myFollows")}
                  icon={{
                    library: "materialcommunityicons",
                    name: "emoticon-plus",
                  }}
                  navigate={() => {
                    navigate({
                      pathname: ROUTES.TABS.MYFOLLOWS,
                      params: pageParams.myfollows,
                    });
                  }}
                />
              ),
            };
          }}
        />
        <Tabs.Screen
          name="market"
          options={() => {
            return {
              title: t("navigation:tabs.market"),
              tabBarIcon: () => (
                <AnimatedTabIcon
                  focused={pathname === `/${ROUTES.TABS.MARKET}`}
                  title={t("navigation:tabs.market")}
                  icon={{ library: "materialcommunityicons", name: "storefront" }}
                  navigate={() => {
                    navigate({
                      pathname: ROUTES.TABS.MARKET,
                      params: pageParams.market,
                    });
                  }}
                />
              ),
            };
          }}
        />
      </Tabs>
      <ItemRegisterActionButtonTabs />
    </PaperProvider>
  );
}

export default CollectionLayout;
