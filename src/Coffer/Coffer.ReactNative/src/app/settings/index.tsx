import SettingsButton from "@/src/components/settings/settings_button";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { customTheme } from "@/src/theme/theme";
import AntDesign from "@expo/vector-icons/AntDesign";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { View } from "react-native";

function Index() {
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
        title="User"
        icon={
          <AntDesign name="user" size={20} color={customTheme.colors.primary} />
        }
        onPress={() => console.log("user settings")}
        isLastInList={true}
      />
    </View>
  );
}

export default Index;
