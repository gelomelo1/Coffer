import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import CollectionType from "@/src/types/entities/collectiontype";
import Item from "@/src/types/entities/item";
import { getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { adjustColor } from "@/src/utils/frontend_utils";
import {
  Image,
  ListRenderItemInfo,
  TouchableOpacity,
  View,
} from "react-native";

interface CollectionItemListCardProps {
  item: ListRenderItemInfo<Item>;
  collectionType: CollectionType;
}

function CollectionItemListCard({
  item,
  collectionType,
}: CollectionItemListCardProps) {
  console.log(item.item.itemAttributes[0].valueString);
  const darkContrastColor = adjustColor(collectionType.color, -0.6);
  const lightContrastColor = adjustColor(collectionType.color, 0.8);
  const primaryValue = getItemPrimaryAttributeValue(item.item.itemAttributes);
  return (
    <TouchableOpacity
      onPress={() => console.log(item.item.id)}
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
          uri: item.item.image
            ? `${endpoints.itemsCoverImage}/${item.item.image}`
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
            {primaryValue.value.toString()}
          </CustomText>
        )}
        <CustomText
          style={{
            fontSize: 14,
            color: lightContrastColor,
          }}
        >
          {new Date(item.item.acquiredAt).toLocaleDateString()}
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
          {item.item.quantity}
          <CustomText style={{ color: lightContrastColor, fontSize: 12 }}>
            pcs
          </CustomText>
        </CustomText>
      </View>
    </TouchableOpacity>
  );
}

export default CollectionItemListCard;
