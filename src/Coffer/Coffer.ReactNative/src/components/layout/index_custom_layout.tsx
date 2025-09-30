import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { customTheme } from "@/src/theme/theme";
import { parseParams } from "@/src/utils/navigation_utils";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { navigate } from "expo-router/build/global-state/routing";
import { TouchableOpacity, View } from "react-native";
import { Icon } from "react-native-elements";
import CustomText from "../custom_ui/custom_text";

function IndexCustomLayout(route: RouteProp<ParamListBase, string>) {
  const params = parseParams(route);

  if (!params || route.name === "collections/tabs")
    return {
      headerShown: false,
    };

  return {
    title: "",
    headerShown: params ? true : false,
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
        <CustomText
          style={{ fontFamily: "VendSansBold", fontSize: 20 }}
          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {params.title}
        </CustomText>
        {params.description ? (
          <View
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              flexDirection: "row",
              marginLeft: 20,
            }}
          >
            <CustomText
              style={{
                fontSize: 14,
                color: params.description.color ?? customTheme.colors.primary,
                borderBottomWidth: 10,
                borderBottomColor:
                  params.description.color ?? customTheme.colors.primary,
                paddingLeft: params.description.icon ? 10 : 0,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {params.description.title}
            </CustomText>
          </View>
        ) : null}
      </View>
    ),
    headerRight: () =>
      params.isSettingsShown ? (
        <TouchableOpacity
          onPress={() =>
            navigate({
              pathname: ROUTES.SETTINGS.ROOT,
              params: pageParams.settings,
            })
          }
        >
          <Icon name="settings" color={customTheme.colors.primary} />
        </TouchableOpacity>
      ) : null,
  };
}

export default IndexCustomLayout;
