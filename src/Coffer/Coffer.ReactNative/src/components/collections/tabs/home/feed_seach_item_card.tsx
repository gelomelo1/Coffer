import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { initItemStore } from "@/src/hooks/item_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import ItemSearch from "@/src/types/entities/item_search";
import User from "@/src/types/entities/user";
import { getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { navigate } from "expo-router/build/global-state/routing";
import { Image, TouchableOpacity, View } from "react-native";

interface FeedSearchItemCardProps {
  currentUser: User;
  itemSearch: ItemSearch;
  closeOverlay: () => void;
}

function FeedSearchItemCard({
  currentUser,
  itemSearch,
  closeOverlay,
}: FeedSearchItemCardProps) {
  const { token } = useUserStore();
  const { setValues } = useOtherUserStore();
  const { setCollection } = useCollectionStore();

  const handleNavigation = () => {
    if (currentUser.id === itemSearch.user.id) {
      setCollection(itemSearch.collection);
      initItemStore(itemSearch.item);
      navigate({
        pathname: ROUTES.ITEMDETAILS,
        params: pageParams.itemdetails,
      });
    } else {
      setValues(itemSearch.user, itemSearch.collection, itemSearch.item);
      navigate({
        pathname: ROUTES.OTHERUSERITEMDETAILS,
        params: pageParams.otheruseritemdetails(itemSearch.collection.name),
      });
    }
    closeOverlay();
  };

  const primaryAttribute = getItemPrimaryAttributeValue(
    itemSearch.item.itemAttributes,
  );

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
          uri: `${endpoints.itemsCoverImage}/${itemSearch.item.image}`,
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
          {primaryAttribute?.valueString}
        </CustomText>
        <CustomText style={{ fontSize: 14 }}>
          {`${itemSearch.user.name}'s ${itemSearch.collection.name} collection`}
        </CustomText>
      </View>
    </TouchableOpacity>
  );
}

export default FeedSearchItemCard;
