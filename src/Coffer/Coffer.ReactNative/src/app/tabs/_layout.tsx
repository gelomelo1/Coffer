import AnimatedTabIcon from "@/src/components/collections/tabs/layout/animated_tab_icon";
import CollectionTabsCustomLayout from "@/src/components/collections/tabs/layout/collection_tabs_custom_layout";
import ItemRegisterActionButtonTabs from "@/src/components/itemregister/item_register_action_button_tabs";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { Tabs, usePathname } from "expo-router";
import { navigate } from "expo-router/build/global-state/routing";
import React from "react";
import { Provider as PaperProvider } from "react-native-paper";

function CollectionLayout() {
  const pathname = usePathname();

  return (
    <PaperProvider>
      <Tabs screenOptions={({ route }) => CollectionTabsCustomLayout(route)}>
        <Tabs.Screen
          name="index"
          options={() => {
            return {
              title: "Home",
              tabBarIcon: () => (
                <AnimatedTabIcon
                  focused={pathname === `/${ROUTES.TABS.HOME}`}
                  title="Home"
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
              title: "Collections",
              tabBarIcon: () => (
                <AnimatedTabIcon
                  focused={pathname === `/${ROUTES.TABS.COLLECTIONS}`}
                  title="Collections"
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
              title: "My Follows",
              tabBarIcon: () => (
                <AnimatedTabIcon
                  focused={pathname === `/${ROUTES.TABS.MYFOLLOWS}`}
                  title="My Follows"
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
          name="barter"
          options={() => {
            return {
              title: "Barter",
              tabBarIcon: () => (
                <AnimatedTabIcon
                  focused={pathname === `/${ROUTES.TABS.BARTER}`}
                  title="Barter"
                  icon={{ library: "fontawesome", name: "exchange" }}
                  navigate={() => {
                    navigate({
                      pathname: ROUTES.TABS.BARTER,
                      params: pageParams.barter,
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
