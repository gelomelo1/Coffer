import User from "@/src/types/entities/user";
import { NavigationParams } from "@/src/types/helpers/navigation";
import { parseParams } from "@/src/utils/navigation_utils";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { AppHeader, headerTexts } from "./app_header";

function SettingsHeader({ params }: { params: NavigationParams | undefined }) {
  const { t } = useTranslation();
  const { title } = headerTexts(params, t);
  return <AppHeader title={t("settings:title")} subtitle={title} />;
}

function SettingsCustomLayout(_user: User | null, route: RouteProp<ParamListBase, string>) {
  const params = parseParams(route);
  return {
    headerShown: !!params,
    header: () => <SettingsHeader params={params} />,
  };
}

export default SettingsCustomLayout;
