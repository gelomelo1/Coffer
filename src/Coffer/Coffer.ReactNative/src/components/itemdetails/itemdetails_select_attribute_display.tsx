import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import ItemOptions from "@/src/types/entities/itemoptions";
import AttributeValue from "@/src/types/helpers/attribute_data";
import CustomText from "../custom_ui/custom_text";

function ItemDetailsSelectAttributeDisplay({
  attributeValue,
  darkContrastColor,
}: {
  attributeValue: AttributeValue;
  darkContrastColor: string;
}) {
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
    <>
      {selectValues.map((value, index) => (
        <CustomText
          key={index}
          style={{
            color: darkContrastColor,
            fontFamily: "VendSansBold",
            fontSize: 14,
          }}
        >
          {`\u2022 ${getAttributeLabel(value)}`}
        </CustomText>
      ))}
    </>
  );
}

export default ItemDetailsSelectAttributeDisplay;
