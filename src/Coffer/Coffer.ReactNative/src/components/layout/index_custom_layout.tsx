import User from "@/src/types/entities/user";
import { NavigationParams } from "@/src/types/helpers/navigation";
import { parseParams } from "@/src/utils/navigation_utils";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { AppHeader, headerTexts } from "./app_header";

function IndexHeader({ user, params }: { user: User | null; params: NavigationParams | undefined }) {
  const { t } = useTranslation();
  const { title, screenTitle } = headerTexts(params, t);
  return (
    <AppHeader
      title={title ?? (user?.name ? t("navigation:header.hello", { name: user.name }) : "")}
      subtitle={screenTitle}
    />
  );
}

/** Header for pushed screens outside a collection (listing details, chat, other user). */
function IndexCustomLayout(user: User | null, route: RouteProp<ParamListBase, string>) {
  const params = parseParams(route);
  return {
    headerShown: !!params,
    header: () => <IndexHeader user={user} params={params} />,
  };
}

export default IndexCustomLayout;
