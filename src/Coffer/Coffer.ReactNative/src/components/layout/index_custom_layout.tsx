import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { customTheme } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import { parseParams } from "@/src/utils/navigation_utils";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { navigate } from "expo-router/build/global-state/routing";
import { TouchableOpacity, View } from "react-native";
import { Icon } from "react-native-elements";
import CustomText from "../custom_ui/custom_text";

function IndexCustomLayout(
  user: User | null,
  route: RouteProp<ParamListBase, string>
) {
  const params = parseParams(route);
  if (
    route.name === (ROUTES.COLLECTIONS.HOME as string) ||
    route.name === (ROUTES.LOGIN as string) ||
    route.name === (ROUTES.ITEMDETAILS as string) ||
    route.name === (ROUTES.OTHERUSER as string) ||
    route.name === (ROUTES.OTHERUSERCOLLECTION as string) ||
    route.name === (ROUTES.OTHERUSERITEMDETAILS as string) ||
    route.name === (ROUTES.TRADEDETAILS as string) ||
    route.name === (ROUTES.OFFERDETAILS as string)
  )
    return {
      headerShown: false,
    };

  let title = params?.title ?? (user?.name ? `Hello ${user.name}!` : "");
  let screenTitle = params?.screenTitle ?? null;
  let isSettingsShown = params?.isSettingsShown ?? true;

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
          {title}
        </CustomText>
        <View
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            flexDirection: "row",
            marginLeft: 20,
          }}
        >
          {screenTitle ? (
            <CustomText
              style={{
                fontSize: 14,
                color: customTheme.colors.primary,
                borderBottomWidth: 10,
                borderBottomColor: customTheme.colors.primary,
                paddingLeft: 0,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {screenTitle}
            </CustomText>
          ) : null}
        </View>
      </View>
    ),
    headerRight: () =>
      isSettingsShown ? (
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
