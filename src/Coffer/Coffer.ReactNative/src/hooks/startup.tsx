import { QueryClient } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { SplashScreen } from "expo-router";
import { useEffect } from "react";

function useStartup() {
  const queryClient = new QueryClient();

  const [loaded, error] = useFonts({
    VendSansRegular: require("../../assets/fonts/VendSans-Regular.ttf"),
    VendSansItalic: require("../../assets/fonts/VendSans-Italic.ttf"),
    VendSansSemiBold: require("../../assets/fonts/VendSans-SemiBold.ttf"),
    VendSansBold: require("../../assets/fonts/VendSans-Bold.ttf"),
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  const isReady = loaded && !error;

  return { isReady, queryClient };
}

export default useStartup;
