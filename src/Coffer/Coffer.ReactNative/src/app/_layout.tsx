import "../i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import SuspendedScreen from "../components/account/suspended_screen";
import ConnectionScreen from "../components/custom_ui/connection_screen";
import { toastConfig } from "../components/custom_ui/toast_config";
import useStartup from "../hooks/startup";
import { useUserStore } from "../hooks/user_store";

export default function Layout() {
  const { isReady, queryClient } = useStartup();
  const { user } = useUserStore();

  if (!isReady) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
        <SuspendedScreen />
        <ConnectionScreen />
        <Toast config={toastConfig} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
