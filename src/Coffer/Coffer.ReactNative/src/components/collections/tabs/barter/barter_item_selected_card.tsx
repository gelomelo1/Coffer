import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { customTheme } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import TradeItem from "@/src/types/entities/trade_item";
import { getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { adjustColor } from "@/src/utils/frontend_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Dimensions, Image, TouchableOpacity, View } from "react-native";

interface BarterItemSelectedCardProps {
  collectionType: CollectionType;
  item: TradeItem;
  onRemoveButtonPressed: (item: TradeItem) => void;
}

function BarterItemSelectedCard({
  collectionType,
  item,
  onRemoveButtonPressed,
}: BarterItemSelectedCardProps) {
  const SCREEN_WIDTH = Dimensions.get("window").width;
  const CARD_WIDTH = SCREEN_WIDTH / 3 - 16;

  const darkContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.dark
  );
  const lightContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.light
  );
  const primaryValue = item.item
    ? getItemPrimaryAttributeValue(item.item?.itemAttributes)
    : null;

  return (
    <View
      style={{
        width: CARD_WIDTH,
        height: "auto",
        padding: 4,
        backgroundColor: collectionType.color,
        borderWidth: 2,
        borderColor: darkContrastColor,
      }}
    >
      <TouchableOpacity
        style={{ position: "absolute", top: 0, right: 0, zIndex: 1 }}
        onPress={() => onRemoveButtonPressed(item)}
      >
        <AntDesign name="close" size={24} color="red" />
      </TouchableOpacity>
      <Image
        source={
          item.item
            ? item.item.image
              ? {
                  uri: `${endpoints.itemsCoverImage}/${item.item.image}`,
                  cache: "reload",
                }
              : {
                  uri: `${endpoints.icons}/${collectionType.icon}`,
                  cache: "reload",
                }
            : require("../../../../../assets/images/image_not_found.jpg")
        }
        style={{
          width: "100%",
          ...(item ? { aspectRatio: "1/1" } : { height: 100 }),
          borderWidth: 2,
          borderColor: darkContrastColor,
        }}
      />
      {item.item ? (
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
          <CustomText style={{ color: darkContrastColor, marginLeft: 10 }}>
            {item.item.quantity}
            <CustomText style={{ color: lightContrastColor, fontSize: 12 }}>
              pcs
            </CustomText>
          </CustomText>
        </View>
      ) : (
        <CustomText>Item not found</CustomText>
      )}
    </View>
  );
}

export default BarterItemSelectedCard;
