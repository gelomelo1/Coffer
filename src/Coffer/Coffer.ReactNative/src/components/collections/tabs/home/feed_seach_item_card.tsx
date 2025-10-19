import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import ItemSearch from "@/src/types/entities/item_search";
import { getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { navigate } from "expo-router/build/global-state/routing";
import { Image, TouchableOpacity, View } from "react-native";

interface FeedSearchItemCardProps {
  itemSearch: ItemSearch;
}

function FeedSearchItemCard({ itemSearch }: FeedSearchItemCardProps) {
  const { setValues } = useOtherUserStore();

  const handleNavigation = () => {
    setValues(itemSearch.user, itemSearch.collection, itemSearch.item);
    navigate({
      pathname: ROUTES.OTHERUSERITEMDETAILS,
      params: pageParams.otheruseritemdetails(itemSearch.collection.name),
    });
  };

  const primaryAttribute = getItemPrimaryAttributeValue(
    itemSearch.item.itemAttributes
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
