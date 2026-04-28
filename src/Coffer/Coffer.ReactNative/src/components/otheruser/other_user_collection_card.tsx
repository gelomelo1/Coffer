import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import User from "@/src/types/entities/user";
import { adjustColor } from "@/src/utils/frontend_utils";
import { navigate } from "expo-router/build/global-state/routing";
import { Image, TouchableOpacity, View } from "react-native";
import CustomText from "../custom_ui/custom_text";

interface OtherUserCollectionCardProps {
  currentUser: User;
  user: User;
  collection: Collection;
  collectionType: CollectionType;
}

function OtherUserCollectionCard({
  currentUser,
  user,
  collection,
  collectionType,
}: OtherUserCollectionCardProps) {
  const { token } = useUserStore();
  const darkContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.dark,
  );

  const { setCollectionType } = useCollectionStore();
  const { setCollection } = useOtherUserStore();
  const { setCollection: setCurrentUserCollection } = useCollectionStore();

  const handleNavigation = () => {
    setCollectionType(collectionType);
    if (currentUser.id === user.id) {
      setCurrentUserCollection(collection);
      navigate({
        pathname: ROUTES.MYCOLLECTION,
        params: pageParams.mycollection,
      });
    } else {
      setCollection(collection);
      navigate({
        pathname: ROUTES.OTHERUSERCOLLECTION,
        params: pageParams.otherusercollection(user.name, collection.name),
      });
    }
  };

  return (
    <TouchableOpacity
      onPress={handleNavigation}
      style={{
        width: "46%",
        height: "auto",
        padding: 4,
        backgroundColor: collectionType.color,
        borderWidth: 2,
        borderColor: darkContrastColor,
      }}
    >
      <Image
        source={{
          uri: collection.image
            ? `${endpoints.collectionsCoverImage}/${collection.image}`
            : `${endpoints.icons}/${collectionType.icon}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "reload",
        }}
        style={{
          width: "100%",
          aspectRatio: "1/1",
          borderWidth: 2,
          borderColor: darkContrastColor,
        }}
      />
      <View
        style={{
          height: 24,
          justifyContent: "center",
        }}
      >
        <CustomText
          numberOfLines={2}
          ellipsizeMode="tail"
          style={{
            fontFamily: "VendSansBold",
            fontSize: 14,
            color: darkContrastColor,
            lineHeight: 12,
          }}
        >
          {collection.name}
        </CustomText>
      </View>
    </TouchableOpacity>
  );
}

export default OtherUserCollectionCard;
