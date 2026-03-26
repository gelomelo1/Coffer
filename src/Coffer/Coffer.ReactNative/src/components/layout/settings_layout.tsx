import { customTheme } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import { parseParams } from "@/src/utils/navigation_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { goBack } from "expo-router/build/global-state/routing";
import { TouchableOpacity } from "react-native";
import CustomText from "../custom_ui/custom_text";

function SettingsCustomLayout(
  user: User | null,
  route: RouteProp<ParamListBase, string>,
) {
  const params = parseParams(route);

  return {
    title: "",
    headerShown: params ? true : false,
    headerStyle: {
      backgroundColor: customTheme.colors.secondary,
      shadowColor: "transparent",
      shadowOpacity: 0,
      shadowOffset: { height: 0 },
      shadowRadius: 0,
      elevation: 0,
    },
    headerLeft: () => (
      <CustomText
        style={{ fontFamily: "VendSansBold", fontSize: 20 }}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        Settings
      </CustomText>
    ),
    headerRight: () => (
      <TouchableOpacity onPress={goBack}>
        <MaterialIcons
          name="arrow-back"
          size={32}
          color={customTheme.colors.primary}
        />
      </TouchableOpacity>
    ),
  };
}

export default SettingsCustomLayout;
