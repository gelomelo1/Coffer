import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import CollectionSearch from "@/src/types/entities/collection_search";
import CollectionType from "@/src/types/entities/collectiontype";
import { navigate } from "expo-router/build/global-state/routing";
import { Image, TouchableOpacity, View } from "react-native";

interface FeedSearchCollectionCardProps {
  collectionType: CollectionType;
  collectionSearch: CollectionSearch;
}

function FeedSearchCollectionCard({
  collectionType,
  collectionSearch,
}: FeedSearchCollectionCardProps) {
  const { setUser, setCollection } = useOtherUserStore();

  const handleNavigation = () => {
    setUser(collectionSearch.user);
    setCollection(collectionSearch.collection);
    navigate({
      pathname: ROUTES.OTHERUSERCOLLECTION,
      params: pageParams.otherusercollection(
        collectionSearch.user.name,
        collectionSearch.collection.name
      ),
    });
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
