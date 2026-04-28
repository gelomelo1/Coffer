import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
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
        <Toast />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
