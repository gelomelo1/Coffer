import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import { endpoints } from "@/src/const/endpoints";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import { querykeys } from "@/src/const/querykeys";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import Attribute from "@/src/types/entities/attribute";
import ItemOptions from "@/src/types/entities/itemoptions";
import { QueryFilterDataItem } from "@/src/types/helpers/attribute_data";
import { QueryFilterData } from "@/src/types/helpers/query_data";
import { getOptions } from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";

interface CollectionItemListDropdownFilterProps {
  attribute: Attribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (
    filter: QueryFilterData,
    id?: string | number
  ) => void;
  draftQueryFilterData?: QueryFilterDataItem;
}

function CollectionItemListDropdownFilter({
  attribute,
  isBottomSheetVisible,
  onQueryFilterDataChange,
  draftQueryFilterData,
}: CollectionItemListDropdownFilterProps) {
  const [selectValue, setSelectValue] = useState<string | null>(null);
  const [dropDownIsOpen, setDropDownIsOpen] = useState(false);

  const { data: optionsData } = useGetSingleData<ItemOptions>(
    `${endpoints.itemOptions}`,
    `${querykeys.itemOptionsData}/${attribute.itemOptionsId}`,
    `${attribute.itemOptionsId}`
  );

  useEffect(() => {
    if (isBottomSheetVisible) {
      setSelectValue(
        (draftQueryFilterData?.value.value as string)?.split(";")[0] ?? null
      );
      setDropDownIsOpen(false);
    }
  }, [isBottomSheetVisible]);

  return (
    <CustomDropdown
      open={dropDownIsOpen}
      label={`${attribute.name} select`}
      value={selectValue}
      setOpen={setDropDownIsOpen}
      setValue={(newValue) => {
        setSelectValue(newValue);
        onQueryFilterDataChange({
          filter: "Contains",
          field: nestedAttributeFilterQuery(attribute.id, "valueString"),
          value: `${newValue};`,
        });
      }}
      items={getOptions(optionsData)}
    />
  );
}

export default CollectionItemListDropdownFilter;
