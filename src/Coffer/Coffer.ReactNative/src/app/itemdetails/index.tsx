import CustomIconButton from "@/src/components/custom_ui/custom_icon_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import rootViewStyle from "@/src/components/custom_ui/root_view";
import ItemDeleteForm from "@/src/components/itemdetails/item_delete_form";
import ItemEditForm from "@/src/components/itemdetails/item_edit_form";
import ItemDetailsDynamicAttributeDisplay from "@/src/components/itemdetails/itemdetails_dynamic_attribute_display";
import { endpoints } from "@/src/const/endpoints";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useItemStore } from "@/src/hooks/item_store";
import { customTheme } from "@/src/theme/theme";
import {
  getItemAttributeValue,
  getItemPrimaryAttributeValue,
} from "@/src/utils/data_access_utils";
import { adjustColor } from "@/src/utils/frontend_utils";
import Fontisto from "@expo/vector-icons/Fontisto";
import { useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { Chip } from "react-native-elements";

function ItemDetails() {
  const { collectionType } = useCollectionStore();
  const { item } = useItemStore();

  const [isItemDeleteConfirmVisible, setIsItemDeleteConfirmVisible] =
    useState(false);

  const [isItemEditFormOverlayOpen, setIsItemEditFormOverlayOpen] =
    useState(false);

  const darkContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.dark
  );

  const lightContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.light
  );

  const primaryAttribute = getItemPrimaryAttributeValue(item.itemAttributes);

  return (
    <>
      <ScrollView style={rootViewStyle({ color: collectionType.color })}>
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
          <Image
            source={{
              uri: `${endpoints.itemsCoverImage}/${item.image}`,
            }}
            style={{
              aspectRatio: "1/1",
            }}
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
            color: collectionType.color,
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
                {new Date(item.acquiredAt).toLocaleDateString()}
              </CustomText>
            </View>
            <CustomText style={{ fontFamily: "VendSansItalic", fontSize: 12 }}>
              {"Acquisition date of the last piece"}
            </CustomText>
          </View>
          <CustomText
            style={{
              color: customTheme.colors.secondary,
              fontFamily: "VendSansBold",
              fontSize: 24,
            }}
          >
            {item.quantity}
            <CustomText>pcs</CustomText>
          </CustomText>
        </View>
        <CustomText style={{ fontSize: 20, marginTop: 20 }}>
          Description
        </CustomText>
        <CustomText style={{ fontFamily: "VendSansItalic" }}>
          {item.description}
        </CustomText>
        <View
          style={{
            justifyContent: "center",
            flexDirection: "row",
            gap: 20,
            marginVertical: 10,
          }}
        >
          <CustomIconButton
            iconName="edit"
            iconType="entypo"
            title="Edit"
            onPress={() => setIsItemEditFormOverlayOpen(true)}
          />
          <CustomIconButton
            iconName="delete"
            iconType="antdesign"
            title="Delete"
            onPress={() => setIsItemDeleteConfirmVisible(true)}
            color="red"
            reverseColor="white"
          />
        </View>
        {item.itemAttributes.map((itemAttribute) =>
          itemAttribute.id === primaryAttribute?.itemAttribute.id ? null : (
            <ItemDetailsDynamicAttributeDisplay
              key={itemAttribute.id}
              attributeValue={getItemAttributeValue(itemAttribute)}
              collectionType={collectionType}
            />
          )
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
          }}
        >
          {item.itemTags.map((tag, index) => (
            <Chip
              key={index}
              title={`#${tag.tag}`}
              titleStyle={{ color: darkContrastColor }}
              buttonStyle={{
                backgroundColor: collectionType.color,
                borderWidth: 2,
                borderColor: lightContrastColor,
              }}
            />
          ))}
        </View>
      </ScrollView>
      <ItemDeleteForm
        isDeleteItemConfirmVisible={{
          value: isItemDeleteConfirmVisible,
          set: setIsItemDeleteConfirmVisible,
        }}
      />
      <ItemEditForm
        isItemEditFormOverlayOpen={{
          value: isItemEditFormOverlayOpen,
          set: setIsItemEditFormOverlayOpen,
        }}
      />
    </>
  );
}

export default ItemDetails;
