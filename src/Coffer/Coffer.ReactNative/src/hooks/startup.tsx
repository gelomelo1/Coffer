import { QueryClient } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { SplashScreen } from "expo-router";
import { useEffect } from "react";
import { useNavigationMode } from "react-native-navigation-mode";
import { initNavigationModeStore } from "./navigation_mode_store";
import useTokenStorage from "./token_storage";
import { useUserStore } from "./user_store";

function useStartup() {
  const queryClient = new QueryClient();

  const {
    isLoaded: isTokenLoaded,
    isError: isTokenError,
    token,
  } = useTokenStorage();

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

  const allLoaded = loaded && !loading && isTokenLoaded;
  const allError = error || navigationModeError || isTokenError;

  useEffect(() => {
    if (allLoaded && !allError && navigationMode !== null) {
      initNavigationModeStore(navigationMode);
      SplashScreen.hideAsync();
    }
  }, [allError, allLoaded, navigationMode]);

  const { setToken } = useUserStore();

  useEffect(() => {
    setToken(token);
  }, [isTokenLoaded, setToken, token]);

  const isReady = allLoaded && !allError && navigationMode !== null;

  return { isReady, queryClient };
}

export default useStartup;
