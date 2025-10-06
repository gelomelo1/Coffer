import CustomText from "@/src/components/custom_ui/custom_text";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { QueryFilterDataItem } from "@/src/types/helpers/attribute_data";
import { QueryFilterData } from "@/src/types/helpers/query_data";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";

interface CollectionItemListBooleanFilterProps {
  attribute: Attribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (
    filter: QueryFilterData,
    id?: string | number
  ) => void;
  draftQueryFilterData?: QueryFilterDataItem;
}

function CollectionItemListBooleanFilter({
  attribute,
  isBottomSheetVisible,
  onQueryFilterDataChange,
  draftQueryFilterData,
}: CollectionItemListBooleanFilterProps) {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    if (isBottomSheetVisible)
      setIsOn((draftQueryFilterData?.value.value as boolean) ?? false);
  }, [isBottomSheetVisible]);

  return (
    <View style={{ justifyContent: "flex-end", flexDirection: "row" }}>
      <CustomText>{`Is ${attribute.name}`}</CustomText>
      <Switch
        value={isOn}
        onValueChange={(newValue) => {
          setIsOn(newValue);
          onQueryFilterDataChange({
            field: nestedAttributeFilterQuery(attribute.id, "valueBoolean"),
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
