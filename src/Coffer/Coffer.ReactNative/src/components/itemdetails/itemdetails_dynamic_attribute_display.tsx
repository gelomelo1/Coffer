import { colors, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import CollectionType from "@/src/types/entities/collectiontype";
import AttributeValue, {
  AttributeDataTypes,
} from "@/src/types/helpers/attribute_data";
import { ReactNode } from "react";
import ItemDetailsAttributeContainer from "./itemdetails_attribute_container";
import ItemDetailsSelectAttributeDisplay from "./itemdetails_select_attribute_display";

interface ItemDetailsDynamicAttributeDisplayProps {
  attributeValue: AttributeValue;
  /** Kept for callers; the row style no longer depends on the type color. */
  collectionType?: CollectionType;
}

function ItemDetailsDynamicAttributeDisplay({ attributeValue }: ItemDetailsDynamicAttributeDisplayProps) {
  const { t, i18n } = useTranslation();
  const valueText = (text: string) => <Text style={[typography.body, { color: colors.text }]}>{text}</Text>;

  const getDisplayFormat = (): ReactNode => {
    if (attributeValue.value === null) return null;
    switch (attributeValue.valueKey) {
      case "valueString": {
        const type = attributeValue.itemAttribute.attribute.dataType;
        if (type === AttributeDataTypes.Select || type === AttributeDataTypes.Multi_Select)
          return <ItemDetailsSelectAttributeDisplay attributeValue={attributeValue} />;
        return valueText(attributeValue.value as string);
      }
      case "valueNumber":
        return valueText(attributeValue.value?.toLocaleString(i18n.language) ?? "");
      case "valueBoolean":
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
            <MaterialIcons name={attributeValue.value ? "check-box" : "check-box-outline-blank"} size={20} color={colors.text} />
            {valueText(attributeValue.value ? t("common:yes") : t("common:no"))}
          </View>
        );
      case "valueDate":
        return valueText(new Date(attributeValue.value as string).toLocaleDateString(i18n.language));
      default:
        return null;
    }
  };

  if (attributeValue.value === null) return null;

  return <ItemDetailsAttributeContainer title={attributeValue.itemAttribute.attribute.name}>{getDisplayFormat()}</ItemDetailsAttributeContainer>;
}

export default ItemDetailsDynamicAttributeDisplay;
