import SettingsButton from "@/src/components/settings/settings_button";
import SettingsUserCard from "@/src/components/settings/settings_user_card";
import { webGoogleClientId } from "@/src/const/authAccessConfiguration";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useResetNavigation } from "@/src/hooks/navigation";
import { useUserStore } from "@/src/hooks/user_store";
import { useAgainstMeUnseen } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { navigate } from "expo-router/build/global-state/routing";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { removeToken } from "@/src/utils/token_store";

function Settings() {
  GoogleSignin.configure({
    webClientId: webGoogleClientId,
    offlineAccess: true,
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

  const { user, setUser } = useUserStore();
  const { data: unseenReports = 0 } = useAgainstMeUnseen();

  const handleLogout = async () => {
    try {
      if (user?.provider === "google") await signOut();
      await removeToken();
    } catch (e) {
      console.log(e);
    }
    resetNavigate(ROUTES.ROOT);
  };

  return (
    <View style={{ flex: 1, backgroundColor: customTheme.colors.background }}>
      <SettingsUserCard user={user} setUser={setUser} />

      <SafeAreaView
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 15,
          backgroundColor: customTheme.colors.background,
        }}
      >
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
            <AntDesign
              name="user"
              size={20}
              color={customTheme.colors.primary}
            />
          }
          onPress={() =>
            navigate({
              pathname: ROUTES.SETTINGS.USER,
              params: pageParams.user,
            })
          }
        />
        <SettingsButton
          title={unseenReports > 0 ? `Reports (${unseenReports} new)` : "Reports"}
          icon={
            <MaterialIcons
              name="flag"
              size={20}
              color={unseenReports > 0 ? "red" : customTheme.colors.primary}
            />
          }
          onPress={() =>
            navigate({
              pathname: ROUTES.SETTINGS.REPORTS,
              params: pageParams.reports,
            })
          }
        />
        <SettingsButton
          title="Logout"
          icon={
            <Entypo
              name="log-out"
              size={20}
              color={customTheme.colors.primary}
            />
          }
          onPress={handleLogout}
          isLastInList={true}
        />
      </SafeAreaView>
    </View>
  );
}

export default Settings;
