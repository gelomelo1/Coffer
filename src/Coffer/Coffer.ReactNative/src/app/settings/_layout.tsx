import SettingsCustomLayout from "@/src/components/layout/settings_layout";
import { useUserStore } from "@/src/hooks/user_store";
import { Stack } from "expo-router";

function SettingsLayout() {
  const { user } = useUserStore();

  return (
    <Stack screenOptions={({ route }) => SettingsCustomLayout(user, route)} />
  );
}

export default SettingsLayout;
