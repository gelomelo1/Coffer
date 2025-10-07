import { customTheme } from "@/src/theme/theme";
import CollectionType from "@/src/types/entities/collectiontype";
import AttributeValue from "@/src/types/helpers/attribute_data";
import { adjustColor } from "@/src/utils/frontend_utils";
import { ReactNode } from "react";
import { CheckBox } from "react-native-elements";
import CustomText from "../custom_ui/custom_text";
import ItemDetailsAttributeContainer from "./itemdetails_attribute_container";
import ItemDetailsSelectAttributeDisplay from "./itemdetails_select_attribute_display";

interface ItemDetailsDynamicAttributeDisplayProps {
  attributeValue: AttributeValue;
  collectionType: CollectionType;
}

function ItemDetailsDynamicAttributeDisplay({
  attributeValue,
  collectionType,
}: ItemDetailsDynamicAttributeDisplayProps) {
  const darkContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.dark
  );

  const lightContrastColor = adjustColor(
    collectionType.color,
    customTheme.colorChangePercent.light
  );

  const getDisplayFormat = (): ReactNode => {
    if (attributeValue.value === null) return null;

    switch (attributeValue.valueKey) {
      case "valueString":
        if (attributeValue.itemAttribute.attribute.dataType === "select")
          return (
            <ItemDetailsSelectAttributeDisplay
              attributeValue={attributeValue}
              darkContrastColor={darkContrastColor}
            />
          );
        return (
          <CustomText
            style={{ color: darkContrastColor, fontSize: 20 }}
            numberOfLines={1}
            lineBreakMode="tail"
          >
            {attributeValue.value as string}
          </CustomText>
        );
      case "valueNumber":
        return (
          <CustomText
            style={{ color: darkContrastColor, fontSize: 20 }}
            numberOfLines={1}
            lineBreakMode="tail"
          >
            {attributeValue.value?.toLocaleString()}
          </CustomText>
        );
      case "valueBoolean":
        return (
          <CheckBox
            size={20}
            containerStyle={{ padding: 0 }}
            uncheckedColor={darkContrastColor}
            checkedColor={darkContrastColor}
            disabled
            checked={attributeValue.value as boolean}
          />
        );
      case "valueDate": {
        return (
          <CustomText
            style={{ color: darkContrastColor, fontSize: 20 }}
            numberOfLines={1}
            lineBreakMode="tail"
          >
            {new Date(attributeValue.value as string).toLocaleDateString()}
          </CustomText>
        );
      }
      default:
        return null;
    }
  };

  if (attributeValue.value === null) return null;

  return (
    <ItemDetailsAttributeContainer
      collectionTypeColor={collectionType.color}
      darkContrastColor={darkContrastColor}
      lightContrastColor={lightContrastColor}
      title={attributeValue.itemAttribute.attribute.name}
    >
      {getDisplayFormat()}
    </ItemDetailsAttributeContainer>
  );
}

export default ItemDetailsDynamicAttributeDisplay;
