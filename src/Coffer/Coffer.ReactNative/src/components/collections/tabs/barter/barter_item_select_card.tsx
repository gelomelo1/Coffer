import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { customTheme } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import { ItemProvided } from "@/src/types/entities/item";
import { Offer } from "@/src/types/entities/offer";
import { Trade } from "@/src/types/entities/trade";
import {
  getItemPrimaryAttributeValue,
  isItemAvailableForTrade,
} from "@/src/utils/data_access_utils";
import {
  adjustColor,
  convertToGrayScaleColor,
} from "@/src/utils/frontend_utils";
import React, { useState } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { Grayscale } from "react-native-color-matrix-image-filters";
import { Overlay } from "react-native-elements";

interface BarterItemSelectCardProps {
  collectionType: CollectionType;
  item: ItemProvided;
  selectedBarterItemId: {
    value: string | null;
    set: React.Dispatch<React.SetStateAction<string | null>>;
  };
  trades: Trade[];
  offers: Offer[];
  trade?: Trade;
}

function BarterItemSelectCard({
  collectionType,
  item,
  selectedBarterItemId,
  trades,
  offers,
  trade,
}: BarterItemSelectCardProps) {
  const [isDisabledTextOverlayVisible, setIsDisabledTextOverlayVisible] =
    useState(false);

  const darkContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.dark
  );
  const lightContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.light
  );
  const collectionTypeColorGrayScale = convertToGrayScaleColor(
    collectionType.color
  );
  const darkContrastColorGrayScale = convertToGrayScaleColor(darkContrastColor);
  const lightContrastColorGrayScale =
    convertToGrayScaleColor(lightContrastColor);
  const primaryValue = getItemPrimaryAttributeValue(item.itemAttributes);

  const isItemDisabled = !isItemAvailableForTrade(item, trades, offers, trade);

  const handleCardPress = () => {
    if (isItemDisabled) {
      setIsDisabledTextOverlayVisible(true);
    } else {
      selectedBarterItemId.set(item.id);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={{
          width: "33%",
          height: "auto",
          padding: 4,
          backgroundColor: isItemDisabled
            ? collectionTypeColorGrayScale
            : collectionType.color,
          borderWidth: 2,
          borderColor: isItemDisabled
            ? darkContrastColorGrayScale
            : selectedBarterItemId.value === item.id
            ? lightContrastColor
            : darkContrastColor,
        }}
        onPress={handleCardPress}
      >
        {isItemDisabled ? (
          <CustomText
            style={{
              position: "absolute",
              fontFamily: "VendSansItalic",
              fontSize: 24,
              color: "red",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 1,
              textAlign: "center",
              textAlignVertical: "center",
              includeFontPadding: false,
              lineHeight: undefined,
            }}
          >
            Not available
          </CustomText>
        ) : null}
        <Grayscale
          amount={isItemDisabled ? 1 : 0} // 1 = full grayscale, 0 = normal
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
              aspectRatio: 1,
              borderWidth: 2,
              borderColor: isItemDisabled
                ? darkContrastColorGrayScale
                : darkContrastColor,
            }}
          />
        </Grayscale>
        <View>
          {primaryValue?.value && (
            <CustomText
              numberOfLines={2}
              ellipsizeMode="tail"
              style={{
                fontFamily: "VendSansBold",
                color: isItemDisabled
                  ? darkContrastColorGrayScale
                  : darkContrastColor,
              }}
            >
              {primaryValue.valueString}
            </CustomText>
          )}
          <CustomText
            style={{
              color: isItemDisabled
                ? darkContrastColorGrayScale
                : darkContrastColor,
              marginLeft: 10,
            }}
          >
            {item.quantity}
            <CustomText
              style={{
                color: isItemDisabled
                  ? lightContrastColorGrayScale
                  : lightContrastColor,
                fontSize: 12,
              }}
            >
              pcs
            </CustomText>
          </CustomText>
        </View>
      </TouchableOpacity>
      <Overlay
        overlayStyle={{
          width: "90%",
          backgroundColor: customTheme.colors.background,
        }}
        isVisible={isDisabledTextOverlayVisible}
        onBackdropPress={() => setIsDisabledTextOverlayVisible(false)}
      >
        <CustomText style={{ textAlign: "center" }}>
          {" "}
          Not available for trade: only one piece left in your collection or
          others pieces are in active trades/offers.
        </CustomText>
      </Overlay>
    </>
  );
}

export default BarterItemSelectCard;
