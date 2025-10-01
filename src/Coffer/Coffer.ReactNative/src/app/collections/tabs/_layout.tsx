import AnimatedTabIcon from "@/src/components/collections/tabs/layout/animated_tab_icon";
import CollectionTabsCustomLayout from "@/src/components/collections/tabs/layout/collection_tabs_custom_layout";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { Tabs, usePathname } from "expo-router";
import { navigate } from "expo-router/build/global-state/routing";
import React from "react";

function CollectionLayout() {
  const pathname = usePathname();

  return (
    <Tabs screenOptions={({ route }) => CollectionTabsCustomLayout(route)}>
      <Tabs.Screen
        name="index"
        options={() => {
          return {
            title: "Home",
            tabBarIcon: () => (
              <AnimatedTabIcon
                focused={pathname === `/${ROUTES.COLLECTIONS.HOME}`}
                title="Home"
                icon={{ library: "fontawesome", name: "home" }}
                navigate={() => {
                  navigate({
                    pathname: ROUTES.COLLECTIONS.HOME,
                    params: pageParams.home,
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
                focused={pathname === `/${ROUTES.COLLECTIONS.BARTER}`}
                title="Barter"
                icon={{ library: "fontawesome", name: "exchange" }}
                navigate={() => {
                  navigate({
                    pathname: ROUTES.COLLECTIONS.BARTER,
                    params: pageParams.barter,
                  });
                }}
              />
            ),
          };
        }}
      />
      <Tabs.Screen
        name="mycollection"
        options={() => {
          return {
            title: "My Collection",
            tabBarIcon: () => (
              <AnimatedTabIcon
                focused={pathname === `/${ROUTES.COLLECTIONS.MYCOLLECTION}`}
                title="My Collection"
                icon={{
                  library: "materialcommunityicons",
                  name: "treasure-chest",
                }}
                navigate={() => {
                  navigate({
                    pathname: ROUTES.COLLECTIONS.MYCOLLECTION,
                    params: pageParams.mycollection,
                  });
                }}
              />
            ),
          };
        }}
      />
    </Tabs>
  );
}

export default CollectionLayout;
