import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { querykeys } from "@/src/const/querykeys";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import { initItemStore } from "@/src/hooks/item_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import OfferItem from "@/src/types/entities/offer_item";
import TradeItem from "@/src/types/entities/trade_item";
import User from "@/src/types/entities/user";
import { getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { adjustColor } from "@/src/utils/frontend_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import { navigate } from "expo-router/build/global-state/routing";
import { Dimensions, Image, TouchableOpacity, View } from "react-native";

interface BarterItemSelectedCardProps {
  collectionType: CollectionType;
  item: TradeItem | OfferItem;
  onRemoveButtonPressed?: (item: TradeItem | OfferItem) => void;
  user?: User;
}

function BarterItemSelectedCard({
  collectionType,
  item,
  onRemoveButtonPressed,
  user,
}: BarterItemSelectedCardProps) {
  const { user: currentUser } = useUserStore();
  const { setValues } = useOtherUserStore();

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

  const { refetch } = useGetSingleData<Collection>(
    endpoints.collections,
    querykeys.collectionForItemData,
    item.item?.collectionId,
    undefined,
    undefined,
    {
      enabled: false,
      queryKey: [querykeys.collectionForItemData],
    }
  );

  const handleNavigation = async () => {
    if (item.item && user) {
      if (currentUser!.id === user!.id) {
        initItemStore(item.item);
        navigate({
          pathname: ROUTES.ITEMDETAILS,
          params: pageParams.itemdetails,
        });
      } else {
        const collection = (await refetch()).data;
        if (collection) {
          setValues(user, collection, item.item);
          navigate({
            pathname: ROUTES.OTHERUSERITEMDETAILS,
            params: pageParams.otheruseritemdetails(collection.name),
          });
        }
      }
    }
  };

  return (
    <TouchableOpacity
      style={{
        width: CARD_WIDTH,
        height: "auto",
        padding: 4,
        backgroundColor: collectionType.color,
        borderWidth: 2,
        borderColor: darkContrastColor,
      }}
      onPress={handleNavigation}
    >
      {onRemoveButtonPressed ? (
        <TouchableOpacity
          style={{ position: "absolute", top: 0, right: 0, zIndex: 1 }}
          onPress={() => onRemoveButtonPressed(item)}
        >
          <AntDesign name="close" size={24} color="red" />
        </TouchableOpacity>
      ) : null}
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
          ...(item.item ? { aspectRatio: "1/1" } : { height: 100 }),
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
          {user ? null : (
            <CustomText style={{ color: darkContrastColor, marginLeft: 10 }}>
              {item.item.quantity}
              <CustomText style={{ color: lightContrastColor, fontSize: 12 }}>
                pcs
              </CustomText>
            </CustomText>
          )}
        </View>
      ) : (
        <CustomText>Item not found</CustomText>
      )}
    </TouchableOpacity>
  );
}

export default BarterItemSelectedCard;
