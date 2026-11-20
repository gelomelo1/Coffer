import { Avatar } from "@/src/components/custom_ui/avatar";
import { SectionHeader } from "@/src/components/custom_ui/card";
import { ConfirmDialog } from "@/src/components/custom_ui/confirm_dialog";
import { ListRow } from "@/src/components/custom_ui/list_row";
import { Screen } from "@/src/components/custom_ui/screen";
import { Tag } from "@/src/components/custom_ui/tag";
import { webGoogleClientId } from "@/src/const/authAccessConfiguration";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useAgainstMeUnseen } from "@/src/hooks/market_api";
import { usePendingSummary } from "@/src/hooks/pending";
import { useResetNavigation } from "@/src/hooks/navigation";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, sizes } from "@/src/theme/theme";
import { removeToken } from "@/src/utils/token_store";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { navigate } from "expo-router/build/global-state/routing";
import { useState } from "react";
import { LANGUAGE_NAMES } from "@/src/i18n/language";
import { AppLanguage } from "@/src/i18n/resources";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

function Group({ children }: { children: React.ReactNode }) {
  return <View style={{ borderWidth: borders.width, borderColor: colors.border }}>{children}</View>;
}

/** Settings hub: profile shortcut, account rows, developer tools and a separated logout (confirmed first). */
function Settings() {
  const { t, i18n } = useTranslation();
  GoogleSignin.configure({
    webClientId: webGoogleClientId,
    offlineAccess: true,
    scopes: ["profile", "email"],
  });

  const resetNavigate = useResetNavigation();
  const { user } = useUserStore();
  const { data: unseenReports = 0 } = useAgainstMeUnseen();
  const { data: pendingSummary = [] } = usePendingSummary();
  const waiting = pendingSummary.reduce((sum, s) => sum + s.count, 0);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleLogout = async () => {
    try {
      if (user?.provider === "google") {
        try {
          await GoogleSignin.revokeAccess();
          await GoogleSignin.signOut();
        } catch (error) {
          console.error("Error signing out from Google:", error);
        }
      }
      await removeToken();
    } catch (e) {
      console.log(e);
    }
    setConfirmLogout(false);
    resetNavigate(ROUTES.ROOT);
  };

  const icon = (name: React.ComponentProps<typeof MaterialIcons>["name"], color: string = colors.text) => (
    <MaterialIcons name={name} size={sizes.iconMd} color={color} />
  );

  return (
    <Screen scroll>
      <Group>
        <ListRow
          title={user?.name ?? ""}
          subtitle={t("settings:index.profileSubtitle")}
          leading={<Avatar uri={user?.avatar} size={48} />}
          onPress={() => navigate({ pathname: ROUTES.SETTINGS.USER, params: pageParams.user })}
        />
      </Group>

      <View>
        <SectionHeader title={t("settings:index.account")} />
        <Group>
          <ListRow
            title={t("settings:index.pending")}
            subtitle={t("settings:index.pendingSubtitle")}
            leading={icon("inbox")}
            trailing={
              waiting > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Tag label={t("settings:pending.count", { count: waiting })} color={colors.secondary} />
                  <MaterialIcons name="chevron-right" size={sizes.iconMd} color={colors.text} />
                </View>
              ) : undefined
            }
            accessibilityLabel={waiting > 0 ? `${t("settings:index.pending")}, ${t("settings:pending.count", { count: waiting })}` : undefined}
            onPress={() => navigate({ pathname: ROUTES.SETTINGS.PENDING, params: pageParams.pending })}
          />
          <ListRow
            style={{ borderTopWidth: borders.hairline, borderColor: colors.borderMuted }}
            title={t("settings:index.reports")}
            subtitle={t("settings:index.reportsSubtitle")}
            leading={icon("flag", unseenReports > 0 ? colors.danger : colors.text)}
            trailing={
              unseenReports > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Tag label={t("settings:index.newCount", { count: unseenReports })} color={colors.danger} />
                  <MaterialIcons name="chevron-right" size={sizes.iconMd} color={colors.text} />
                </View>
              ) : undefined
            }
            accessibilityLabel={
              unseenReports > 0 ? `${t("settings:index.reports")}, ${t("settings:index.newCount", { count: unseenReports })}` : undefined
            }
            onPress={() => navigate({ pathname: ROUTES.SETTINGS.REPORTS, params: pageParams.reports })}
          />
        </Group>
      </View>

      <View>
        <SectionHeader title={t("settings:index.app")} />
        <Group>
          <ListRow
            title={t("settings:index.language")}
            subtitle={LANGUAGE_NAMES[(i18n.language as AppLanguage) in LANGUAGE_NAMES ? (i18n.language as AppLanguage) : "en"]}
            leading={icon("language")}
            onPress={() => navigate({ pathname: ROUTES.SETTINGS.LANGUAGE, params: pageParams.language })}
          />
          <ListRow
            style={{ borderTopWidth: borders.hairline, borderColor: colors.borderMuted }}
            title={t("settings:developer.title")}
            leading={icon("developer-mode")}
            onPress={() => navigate({ pathname: ROUTES.SETTINGS.DEVELOPER, params: pageParams.developer })}
          />
        </Group>
      </View>

      <Group>
        <ListRow title={t("settings:index.logout")} leading={icon("logout", colors.danger)} destructive trailing={<View />} onPress={() => setConfirmLogout(true)} />
      </Group>

      <ConfirmDialog
        isVisible={confirmLogout}
        title={t("settings:index.logoutTitle")}
        message={t("settings:index.logoutText")}
        confirmLabel={t("settings:index.logout")}
        destructive
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
      />
    </Screen>
  );
}

export default Settings;
