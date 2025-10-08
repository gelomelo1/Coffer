import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { initItemStore } from "@/src/hooks/item_store";
import { customTheme } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import Item from "@/src/types/entities/item";
import { getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { adjustColor } from "@/src/utils/frontend_utils";
import { navigate } from "expo-router/build/global-state/routing";
import { Image, TouchableOpacity, View } from "react-native";

interface CollectionItemListCardProps {
  item: Item;
  collectionType: CollectionType;
}

function CollectionItemListCard({
  item,
  collectionType,
}: CollectionItemListCardProps) {
  console.log(item.itemAttributes[0].valueString);
  const darkContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.dark
  );
  const lightContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.light
  );
  const primaryValue = getItemPrimaryAttributeValue(item.itemAttributes);

  const handleCardPress = () => {
    initItemStore(item);
    navigate({
      pathname: ROUTES.ITEMDETAILS,
      params: pageParams.itemdetails,
    });
  };

  return (
    <TouchableOpacity
      style={{
        width: "46%",
        height: "auto",
        padding: 4,
        backgroundColor: collectionType.color,
        borderWidth: 2,
        borderColor: darkContrastColor,
      }}
      onPress={handleCardPress}
    >
      <Image
        source={{
          uri: item.image
            ? `${endpoints.itemsCoverImage}/${item.image}`
            : `${endpoints.icons}/${collectionType.icon}`,
          cache: "reload",
        }}
        style={{
          width: "100%",
          aspectRatio: "1/1",
          borderWidth: 2,
          borderColor: darkContrastColor,
        }}
      />
      <View>
        {primaryValue?.value && (
          <CustomText
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{
              fontFamily: "VendSansBold",
              color: darkContrastColor,
            }}
          >
            {primaryValue.valueString}
          </CustomText>
        )}
        <CustomText
          style={{
            fontSize: 14,
            color: lightContrastColor,
          }}
        >
          {new Date(item.acquiredAt).toLocaleDateString()}
        </CustomText>
        <CustomText
          style={{
            fontFamily: "VendSansItalic",
            fontSize: 10,
            color: lightContrastColor,
          }}
        >
          Last acquisition date
        </CustomText>
        <CustomText style={{ color: darkContrastColor, marginLeft: 10 }}>
          {item.quantity}
          <CustomText style={{ color: lightContrastColor, fontSize: 12 }}>
            pcs
          </CustomText>
        </CustomText>
      </View>
    </TouchableOpacity>
  );
}

export default CollectionItemListCard;
