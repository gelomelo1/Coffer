import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import React, { useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import useStartup from "../hooks/startup";
import { customTheme } from "../theme/theme";
import User from "../types/entities/user";

export default function Layout() {
  const [isDeveloperMenuVisible, setIsDeveloperMenuVisible] = useState(false);

  const { isReady, queryClient } = useStartup();

  if (!isReady) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={({ route, navigation }) => {
          // Grab the username from route params if available
          let user: User | undefined = undefined;
          try {
            user = JSON.parse(route.params?.user as string);
          } catch (e) {
            console.warn("Failed to parse user from route params", e);
          }

          return {
            title: "",
            headerShown: user ? true : false,
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
                <Text
                  style={{
                    color: customTheme.colors.primary,
                    fontFamily: "VendSansBold",
                    fontSize: 20,
                  }}
                >
                  Hello {user?.name}!
                </Text>
                <Text
                  style={{
                    color: customTheme.colors.primary,
                    fontFamily: "VendSans",
                    marginLeft: 10,
                    borderBottomWidth: 10,
                    borderBottomColor: customTheme.colors.primary,
                  }}
                >
                  {`${
                    route.name[0].toLocaleUpperCase() + route.name.substring(1)
                  }`}
                </Text>
              </View>
            ),
            headerRight: () => (
              <Icon name="settings" color={customTheme.colors.primary} />
            ),
          };
        }}
      />
      <TouchableOpacity
        style={{ position: "absolute", bottom: 0, right: 0, zIndex: 999 }}
        onPress={() => setIsDeveloperMenuVisible(true)}
      >
        <Text>Dev Menu</Text>
      </TouchableOpacity>
      <Modal
        visible={isDeveloperMenuVisible}
        onRequestClose={() => setIsDeveloperMenuVisible(false)}
      >
        <DeveloperMenu />
      </Modal>
      <Toast />
    </QueryClientProvider>
  );
}

function DeveloperMenu() {
  const handleClearStorage = async () => {
    await AsyncStorage.clear();
    alert("Async Storage Cleared");
  };

  return (
    <SafeAreaView
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <TouchableOpacity
        style={{
          width: "100%",
          height: 50,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "white",
          boxShadow: "inset 0 0 5px rgba(0, 0, 0, 1)",
        }}
        onPress={handleClearStorage}
      >
        <Text style={{ fontSize: 18, color: "black" }}>
          Delete Async Storage
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
