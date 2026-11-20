import { ListRow } from "@/src/components/custom_ui/list_row";
import { Screen } from "@/src/components/custom_ui/screen";
import UserInfoCard from "@/src/components/settings/user_info_card";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, sizes } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

/** Own profile: general info (editable), the marketplace reputation, and deleting the account at the very bottom. */
function User() {
  const { t } = useTranslation();
  const { user, setUser } = useUserStore();
  return (
    <Screen scroll>
      <UserInfoCard user={user} setUser={setUser} />
      <View style={{ borderWidth: borders.width, borderColor: colors.border }}>
        <ListRow
          title={t("settings:deleteAccount.row")}
          subtitle={t("settings:deleteAccount.rowSubtitle")}
          leading={<MaterialIcons name="delete-forever" size={sizes.iconMd} color={colors.danger} />}
          destructive
          onPress={() => navigate({ pathname: ROUTES.SETTINGS.DELETE_ACCOUNT, params: pageParams.deleteAccount })}
        />
      </View>
    </Screen>
  );
}

export default User;
