import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import ItemOptions from "@/src/types/entities/itemoptions";
import AttributeValue from "@/src/types/helpers/attribute_data";
import { colors, spacing, typography } from "@/src/theme/theme";
import { Text, View } from "react-native";

function ItemDetailsSelectAttributeDisplay({ attributeValue }: { attributeValue: AttributeValue }) {
  const { data: optionsData } = useGetSingleData<ItemOptions>(
    `${endpoints.itemOptions}`,
    `${querykeys.itemOptionsData}/${attributeValue.itemAttribute.attributeId}`,
    `${attributeValue.itemAttribute.attribute.itemOptionsId}`
  );

  if (!optionsData) return null;

  const optionIds = optionsData.optionIds.split(";");
  const optionLabels = optionsData.optionLabels.split(";");

  const selectValues = attributeValue.value
    ? (attributeValue.value as string).split(";").filter(Boolean)
    : [];

  const getAttributeLabel = (value: string) => {
    const index = optionIds.findIndex((id) => id === value);
    if (index === -1) return "";
    return optionLabels[index];
  };

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 2 }}>
      {selectValues.map((value, index) => (
        <View key={index} style={{ paddingHorizontal: spacing.xs, paddingVertical: 2, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderMuted }}>
          <Text style={[typography.meta, { color: colors.text }]}>{getAttributeLabel(value)}</Text>
        </View>
      ))}
    </View>
  );
}

export default ItemDetailsSelectAttributeDisplay;
