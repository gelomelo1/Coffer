import CustomText from "@/src/components/custom_ui/custom_text";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import { customTheme } from "@/src/theme/theme";
import ItemAttribute from "@/src/types/entities/item_attribute";
import { QueryFilterData } from "@/src/types/helpers/query_data";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";

interface CollectionItemListBooleanFilterProps {
  itemAttribute: ItemAttribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (filter: QueryFilterData) => void;
  draftQueryFilterData?: QueryFilterData;
}

function CollectionItemListBooleanFilter({
  itemAttribute,
  isBottomSheetVisible,
  onQueryFilterDataChange,
  draftQueryFilterData,
}: CollectionItemListBooleanFilterProps) {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    if (isBottomSheetVisible)
      setIsOn((draftQueryFilterData?.value as boolean) ?? false);
  }, [isBottomSheetVisible]);

  return (
    <View style={{ justifyContent: "flex-end", flexDirection: "row" }}>
      <CustomText>{`Is ${itemAttribute.attribute.name}`}</CustomText>
      <Switch
        value={isOn}
        onValueChange={(newValue) => {
          setIsOn(newValue);
          onQueryFilterDataChange({
            field: nestedAttributeFilterQuery(
              itemAttribute.attributeId,
              "valueBoolean"
            ),
            value: newValue,
          });
        }}
        trackColor={{ true: customTheme.colors.secondary }}
        thumbColor={customTheme.colors.primary}
      />
    </View>
  );
}

export default CollectionItemListBooleanFilter;
