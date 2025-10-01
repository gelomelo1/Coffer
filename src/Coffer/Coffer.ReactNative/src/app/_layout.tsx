import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React from "react";
import Toast from "react-native-toast-message";
import IndexCustomLayout from "../components/layout/index_custom_layout";
import useStartup from "../hooks/startup";
import { useUserStore } from "../hooks/user_store";

export default function Layout() {
  const { isReady, queryClient } = useStartup();
  const { user } = useUserStore();

  if (!isReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={({ route }) => IndexCustomLayout(user, route)} />
      <Toast />
    </QueryClientProvider>
  );
}
