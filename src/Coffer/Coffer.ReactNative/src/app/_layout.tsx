import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { navigate } from "expo-router/build/global-state/routing";
import React from "react";
import { Image, View } from "react-native";
import { Icon } from "react-native-elements";
import Toast from "react-native-toast-message";
import CustomText from "../components/custom_ui/custom_text";
import { pageParams, ROUTES } from "../const/navigation_params";
import useStartup from "../hooks/startup";
import { customTheme } from "../theme/theme";
import { parseParams } from "../utils/navigation_utils";

export default function Layout() {
  const { isReady, queryClient } = useStartup();

  if (!isReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={({ route, navigation }) => {
          const params = parseParams(route);

          if (!params)
            return {
              headerShown: false,
            };

          return {
            title: "",
            headerShown: params ? true : false,
            headerStyle: {
              backgroundColor: customTheme.colors.background,
            },
            headerLeft: () => (
              <View
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <CustomText
                  style={{ fontFamily: "VendSansBold", fontSize: 20 }}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {params.title}
                </CustomText>
                {params.description ? (
                  <View
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "flex-start",
                      flexDirection: "row",
                      marginLeft: 10,
                    }}
                  >
                    {params.description?.icon ? (
                      <Image
                        source={require("../../assets/images/icon.png")}
                        style={{ width: 14, height: 14 }}
                      />
                    ) : null}

                    <CustomText
                      style={{
                        fontSize: 14,
                        borderBottomWidth: 10,
                        borderBottomColor: customTheme.colors.primary,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {params.description.title}
                    </CustomText>
                    {params.description.additionalHeadings.length > 0 ? (
                      <CustomText
                        style={{
                          fontSize: 14,
                          color: customTheme.colors.secondary,
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {` -> ${params.description.additionalHeadings.join(
                          " -> "
                        )}`}
                      </CustomText>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ),
            headerRight: () =>
              params.isSettingsShown ? (
                <Icon
                  name="settings"
                  color={customTheme.colors.primary}
                  onPress={() =>
                    navigate({
                      pathname: ROUTES.SETTINGS.ROOT,
                      params: pageParams.settings,
                    })
                  }
                />
              ) : null,
          };
        }}
      />
      <Toast />
    </QueryClientProvider>
  );
}
