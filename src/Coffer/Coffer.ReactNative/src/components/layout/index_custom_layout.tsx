import { customTheme } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import { parseParams } from "@/src/utils/navigation_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { goBack } from "expo-router/build/global-state/routing";
import { TouchableOpacity, View } from "react-native";
import CustomText from "../custom_ui/custom_text";

function IndexCustomLayout(
  user: User | null,
  route: RouteProp<ParamListBase, string>,
) {
  const params = parseParams(route);

  let title = params?.title ?? (user?.name ? `Hello ${user.name}!` : "");
  let screenTitle = params?.screenTitle ?? null;

  return {
    title: "",
    headerShown: params ? true : false,
    headerStyle: {
      backgroundColor: customTheme.colors.secondary,
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

export default IndexCustomLayout;
