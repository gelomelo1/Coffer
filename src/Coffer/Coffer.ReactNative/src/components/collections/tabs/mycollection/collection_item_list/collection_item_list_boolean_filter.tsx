import { Chip, ChipRow } from "@/src/components/custom_ui/chip";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import { colors } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import {
  AttributeTypes,
  QueryFilterDataItem,
} from "@/src/types/helpers/attribute_data";
import { QueryFilterData } from "@/src/types/helpers/query_data";
import { useEffect, useState } from "react";

interface CollectionItemListBooleanFilterProps {
  attribute: Attribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (
    filter: QueryFilterData,
    id?: string | number,
  ) => void;
  draftQueryFilterData?: QueryFilterDataItem;
  filterQuery?: (
    id: number,
    attributeName: AttributeTypes,
    value: any,
  ) => string;
}

function CollectionItemListBooleanFilter({
  attribute,
  isBottomSheetVisible,
  onQueryFilterDataChange,
  draftQueryFilterData,
  filterQuery,
}: CollectionItemListBooleanFilterProps) {
  const { t } = useTranslation();
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    if (isBottomSheetVisible)
      setIsOn((draftQueryFilterData?.value?.value as boolean) ?? false);
  }, [isBottomSheetVisible]);

  const toggle = () => {
    const newValue = !isOn;
    setIsOn(newValue);
    if (filterQuery) {
      onQueryFilterDataChange({ filter: "None", field: filterQuery(attribute.id, "valueBoolean", newValue), value: "" });
    } else {
      onQueryFilterDataChange({ field: nestedAttributeFilterQuery(attribute.id, "valueBoolean"), value: newValue });
    }
  };

  return (
    <ChipRow>
      <Chip
        label={t("collections:filter.isTrue", { name: attribute.name })}
        selected={isOn}
        icon={<MaterialIcons name={isOn ? "check-box" : "check-box-outline-blank"} size={18} color={colors.text} />}
        onPress={toggle}
      />
    </ChipRow>
  );
}

export default CollectionItemListBooleanFilter;
