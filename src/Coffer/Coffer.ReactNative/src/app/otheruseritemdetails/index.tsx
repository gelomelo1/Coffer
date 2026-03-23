import FeedLike from "@/src/components/collections/tabs/home/feed_like";
import FeedRarity from "@/src/components/collections/tabs/home/feed_rarity";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomImage from "@/src/components/custom_ui/custom_image";
import CustomText from "@/src/components/custom_ui/custom_text";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import ItemDetailsDynamicAttributeDisplay from "@/src/components/itemdetails/itemdetails_dynamic_attribute_display";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { ItemProvided } from "@/src/types/entities/item";
import {
  getItemAttributeValue,
  getItemPrimaryAttributeValue,
  getRarityVariantByValue,
} from "@/src/utils/data_access_utils";
import { adjustColor } from "@/src/utils/frontend_utils";
import Fontisto from "@expo/vector-icons/Fontisto";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { ScrollView, View } from "react-native";
import { Chip } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";

function OtherUserItemDetails() {
  const { collectionType } = useCollectionStore();
  const { user: currentUser, token } = useUserStore();
  const { user, collection, item, setItem } = useOtherUserStore();

  const darkContrastColor = adjustColor(
    collectionType!.color,
    customTheme.colorChangePercent.dark,
  );

  const lightContrastColor = adjustColor(
    collectionType!.color,
    customTheme.colorChangePercent.light,
  );

  const primaryAttribute = getItemPrimaryAttributeValue(item!.itemAttributes);

  const rarityVariant = getRarityVariantByValue(item!.reactions);

  const handleItemListNavigation = () => {
    navigate({
      pathname: ROUTES.OTHERUSERCOLLECTION,
      params: pageParams.otherusercollection(user!.name, collection!.name),
    });
  };

  const onItemUpdate = (item: ItemProvided) => {
    setItem(item);
  };

  return (
    <ScrollView style={rootViewStyle({ color: collectionType!.color })}>
      <CustomButton
        title={"Go to user's collections list"}
        icon={
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={customTheme.colors.secondary}
            style={{ marginRight: 5 }}
          />
        }
        containerStyle={{ marginBottom: 10, marginHorizontal: 10 }}
        onPress={handleItemListNavigation}
      />
      <SafeAreaView>
        <View
          style={{
            width: "60%",
            alignSelf: "center",
            borderWidth: 2,
            borderColor: darkContrastColor,
            borderRadius: 5,
            boxShadow: `2px 2px 2px ${darkContrastColor}`,
          }}
        >
          <CustomImage
            uri={
              item!.image
                ? `${endpoints.itemsCoverImage}/${item!.image}`
                : `${endpoints.icons}/${collectionType!.icon}`
            }
            style={{ width: "100%", aspectRatio: 1, resizeMode: "cover" }}
            enableFullScreenView={true}
          />
        </View>
        <CustomText
          style={{
            alignSelf: "center",
            marginTop: 10,
            fontSize: 20,
            borderBottomWidth: 1,
            borderColor: customTheme.colors.primary,
          }}
        >
          {primaryAttribute?.itemAttribute.attribute.name}
        </CustomText>
        <CustomText
          style={{
            alignSelf: "center",
            color: collectionType!.color,
            fontFamily: "VendSansBold",
            fontSize: 24,
            borderTopWidth: 1,
            borderColor: customTheme.colors.primary,
            marginTop: 5,
          }}
          numberOfLines={1}
          lineBreakMode="tail"
        >
          {primaryAttribute?.valueString}
        </CustomText>
        <View style={{ justifyContent: "space-between", flexDirection: "row" }}>
          <View
            style={{
              justifyContent: "flex-start",
              alignItems: "center",
              flexDirection: "row",
              gap: 10,
            }}
          >
            <CustomText style={{ fontSize: 18 }}>Rarity:</CustomText>
            <FeedRarity
              user={currentUser!}
              item={item!}
              onItemUpdate={onItemUpdate}
              fontSize={24}
            />
          </View>
          <FeedLike
            user={currentUser!}
            item={item!}
            onItemUpdate={onItemUpdate}
            color={customTheme.colors.primary}
            fontSize={24}
          />
        </View>
        <View style={{ justifyContent: "space-between", flexDirection: "row" }}>
          <View>
            <View
              style={{
                justifyContent: "flex-start",
                flexDirection: "row",
                gap: 10,
              }}
            >
              <Fontisto name="date" size={20} color="black" />
              <CustomText style={{ fontFamily: "VendSansBold", fontSize: 18 }}>
                {new Date(item!.acquiredAt).toLocaleDateString()}
              </CustomText>
            </View>
            <CustomText style={{ fontFamily: "VendSansItalic", fontSize: 12 }}>
              {"Acquisition date of the first piece"}
            </CustomText>
          </View>
          <CustomText
            style={{
              color: customTheme.colors.secondary,
              fontFamily: "VendSansBold",
              fontSize: 24,
            }}
          >
            {item!.quantity}
            <CustomText>pcs</CustomText>
          </CustomText>
        </View>
        <CustomText style={{ fontSize: 20, marginTop: 20 }}>
          Description
        </CustomText>
        <CustomText
          style={{
            fontFamily: item!.description ? "VendSans" : "VendSansItalic",
            marginBottom: 10,
          }}
        >
          {item!.description ??
            "The user hasn’t added a description to this item yet."}
        </CustomText>
        {item!.itemAttributes.map((itemAttribute) =>
          itemAttribute.id === primaryAttribute?.itemAttribute.id ? null : (
            <ItemDetailsDynamicAttributeDisplay
              key={itemAttribute.id}
              attributeValue={getItemAttributeValue(itemAttribute)}
              collectionType={collectionType!}
            />
          ),
        )}
        <CustomText style={{ fontSize: 20, marginTop: 20, marginBottom: 10 }}>
          Tags
        </CustomText>
        <View
          style={{
            justifyContent: "flex-start",
            flexDirection: "row",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          {item!.itemTags.map((tag, index) => (
            <Chip
              key={index}
              title={`#${tag.tag}`}
              titleStyle={{ color: darkContrastColor }}
              buttonStyle={{
                backgroundColor: collectionType!.color,
                borderWidth: 2,
                borderColor: lightContrastColor,
              }}
            />
          ))}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

export default OtherUserItemDetails;
