import SettingsButton from "@/src/components/settings/settings_button";
import SettingsUserCard from "@/src/components/settings/settings_user_card";
import { asyncstoragekeys } from "@/src/const/async_storage_keys";
import { webGoogleClientId } from "@/src/const/authAccessConfiguration";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useResetNavigation } from "@/src/hooks/navigation";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { navigate } from "expo-router/build/global-state/routing";
import { View } from "react-native";

function Settings() {
  GoogleSignin.configure({
    webClientId: webGoogleClientId, // Your web client ID from Google Developer Console
    offlineAccess: true, // Optional: if you need to access Google APIs
    scopes: ["profile", "email"],
  });

  const signOut = async () => {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch (error) {
      console.error("Error signing out from Google:", error);
    }
  };

  const resetNavigate = useResetNavigation();

  const { user } = useUserStore();

  const handleLogout = async () => {
    try {
      if (user?.provider === "google") await signOut();
      await AsyncStorage.removeItem(asyncstoragekeys.jwt);
    } catch (e) {
      console.log(e);
    }
    resetNavigate(ROUTES.ROOT);
  };

  return (
    <View
      style={{
        flex: 1,
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: 15,
        paddingTop: 15,
        backgroundColor: customTheme.colors.background,
      }}
    >
      <SettingsUserCard user={user} />

      <SettingsButton
        title="Developer options"
        icon={
          <MaterialIcons
            name="developer-mode"
            size={20}
            color={customTheme.colors.primary}
          />
        }
        onPress={() =>
          navigate({
            pathname: ROUTES.SETTINGS.DEVELOPER,
            params: pageParams.developer,
          })
        }
      />
      <SettingsButton
        title="User"
        icon={
          <AntDesign name="user" size={20} color={customTheme.colors.primary} />
        }
        onPress={() => console.log("user settings")}
      />
      <SettingsButton
        title="Logout"
        icon={
          <Entypo name="log-out" size={20} color={customTheme.colors.primary} />
        }
        onPress={handleLogout}
        isLastInList={true}
      />
    </View>
  );
}

export default Settings;
