import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import CollectionSearch from "@/src/types/entities/collection_search";
import CollectionType from "@/src/types/entities/collectiontype";
import User from "@/src/types/entities/user";
import { navigate } from "expo-router/build/global-state/routing";
import { Image, TouchableOpacity, View } from "react-native";

interface FeedSearchCollectionCardProps {
  currentUser: User;
  collectionType: CollectionType;
  collectionSearch: CollectionSearch;
  closeOverlay: () => void;
}

function FeedSearchCollectionCard({
  currentUser,
  collectionType,
  collectionSearch,
  closeOverlay,
}: FeedSearchCollectionCardProps) {
  const { token } = useUserStore();
  const { setUser, setCollection } = useOtherUserStore();
  const { setCollection: setCurrentUserCollection } = useCollectionStore();

  const handleNavigation = () => {
    if (currentUser.id === collectionSearch.user.id) {
      setCurrentUserCollection(collectionSearch.collection);
      navigate({
        pathname: ROUTES.COLLECTIONS.MYCOLLECTION,
        params: pageParams.mycollection,
      });
    } else {
      setUser(collectionSearch.user);
      setCollection(collectionSearch.collection);
      navigate({
        pathname: ROUTES.OTHERUSERCOLLECTION,
        params: pageParams.otherusercollection(
          collectionSearch.user.name,
          collectionSearch.collection.name,
        ),
      });
    }
    closeOverlay();
  };

  return (
    <TouchableOpacity
      style={{
        height: 48,
        justifyContent: "flex-start",
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
      }}
      onPress={handleNavigation}
    >
      <Image
        source={{
          uri: collectionSearch.collection.image
            ? `${endpoints.collectionsCoverImage}/${collectionSearch.collection.image}`
            : `${endpoints.icons}/${collectionType.icon}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "reload",
        }}
        style={{
          height: "100%",
          aspectRatio: "1/1",
        }}
      />
      <View>
        <CustomText style={{ fontFamily: "VendSansBold" }}>
          {collectionSearch.collection.name}
        </CustomText>
        <CustomText style={{ fontSize: 14 }}>
          {collectionSearch.collection.follows.length} followers
        </CustomText>
      </View>
    </TouchableOpacity>
  );
}

export default FeedSearchCollectionCard;
