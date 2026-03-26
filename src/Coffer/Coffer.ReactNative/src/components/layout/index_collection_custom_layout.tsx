import { endpoints } from "@/src/const/endpoints";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { parseParams } from "@/src/utils/navigation_utils";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { goBack } from "expo-router/build/global-state/routing";
import { Image, TouchableOpacity, View } from "react-native";
import CustomText from "../custom_ui/custom_text";

function IndexCollectionCustomLayout(route: RouteProp<ParamListBase, string>) {
  const { user } = useUserStore();
  const { collectionType, collection } = useCollectionStore();
  const params = parseParams(route);

  let screenTitle = null;
  let title = null;
  if (params) {
    if (params.screenTitle) screenTitle = params.screenTitle;
    if (params.title) title = params.title;
  }

  return {
    headerTitle: "",
    headerShown: true,
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
          {`Hello ${user!.name}!`}
        </CustomText>
        <View
          style={{
            position: "relative",
            bottom: -2,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            flexDirection: "row",
            marginLeft: 20,
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: -36,
              backgroundColor: collectionType!.color,
              paddingVertical: 3,
              paddingHorizontal: 6,
              elevation: 8,
            }}
          >
            <Image
              source={{
                uri: `${endpoints.icons}/${collectionType!.icon}`,
              }}
              style={{
                width: 24,
                height: 24,
              }}
            />
          </View>

          <CustomText
            style={{
              fontSize: 14,
              color: collectionType!.color,
              borderBottomWidth: 11,
              borderBottomColor: collectionType!.color,
              paddingLeft: 10,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title ? title : collection!.name}
          </CustomText>
          {screenTitle ? (
            <CustomText
              style={{
                fontSize: 14,
                color: customTheme.colors.secondary,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {` -> ${screenTitle}`}
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

export default IndexCollectionCustomLayout;
