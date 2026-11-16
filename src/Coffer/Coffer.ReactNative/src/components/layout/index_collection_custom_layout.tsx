import { endpoints } from "@/src/const/endpoints";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors } from "@/src/theme/theme";
import { NavigationParams } from "@/src/types/helpers/navigation";
import { parseParams } from "@/src/utils/navigation_utils";
import { ParamListBase, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Image, View } from "react-native";
import { AppHeader, headerTexts } from "./app_header";

function CollectionHeader({ params }: { params: NavigationParams | undefined }) {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const { collectionType, collection } = useCollectionStore();
  const { title, screenTitle } = headerTexts(params, t);

  const collectionName = title ?? collection?.name ?? "";
  const subtitle = screenTitle ? `${collectionName} · ${screenTitle}` : collectionName; // i18n-ignore

  return (
    <AppHeader
      title={user?.name ? t("navigation:header.hello", { name: user.name }) : collectionName}
      subtitle={subtitle}
      subtitleLeading={
        collectionType ? (
          <View
            style={{
              backgroundColor: collectionType.color,
              borderWidth: borders.width,
              borderColor: colors.border,
              padding: 2,
            }}
          >
            <Image source={{ uri: `${endpoints.icons}/${collectionType.icon}` }} style={{ width: 18, height: 18 }} />
          </View>
        ) : null
      }
    />
  );
}

/** Header for screens inside a collection (my collection, item details, other user's collection/items). */
function IndexCollectionCustomLayout(route: RouteProp<ParamListBase, string>) {
  const params = parseParams(route);
  return {
    headerShown: true,
    header: () => <CollectionHeader params={params} />,
  };
}

export default IndexCollectionCustomLayout;
