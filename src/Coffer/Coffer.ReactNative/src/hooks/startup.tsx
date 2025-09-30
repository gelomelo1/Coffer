import { QueryClient } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { SplashScreen } from "expo-router";
import { useEffect } from "react";
import { useNavigationMode } from "react-native-navigation-mode";
import { initNavigationModeStore } from "./navigation_mode_store";

function useStartup() {
  const queryClient = new QueryClient();

  const [loaded, error] = useFonts({
    VendSansRegular: require("../../assets/fonts/VendSans-Regular.ttf"),
    VendSansItalic: require("../../assets/fonts/VendSans-Italic.ttf"),
    VendSansSemiBold: require("../../assets/fonts/VendSans-SemiBold.ttf"),
    VendSansBold: require("../../assets/fonts/VendSans-Bold.ttf"),
  });

  const {
    navigationMode,
    loading,
    error: navigationModeError,
  } = useNavigationMode();

  const allLoaded = loaded && !loading;
  const allError = error || navigationModeError;

  useEffect(() => {
    if (allLoaded && !allError && navigationMode !== null) {
      initNavigationModeStore(navigationMode);
      SplashScreen.hideAsync();
    }
  }, [allError, allLoaded, navigationMode]);

  const isReady = allLoaded && !allError && navigationMode !== null;

  return { isReady, queryClient };
}

export default useStartup;
