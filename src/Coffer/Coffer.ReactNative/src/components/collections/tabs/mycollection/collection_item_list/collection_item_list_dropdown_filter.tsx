import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import { endpoints } from "@/src/const/endpoints";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import { querykeys } from "@/src/const/querykeys";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import ItemAttribute from "@/src/types/entities/item_attribute";
import ItemOptions from "@/src/types/entities/itemoptions";
import { QueryFilterData } from "@/src/types/helpers/query_data";
import { getOptions } from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";

interface CollectionItemListDropdownFilterProps {
  itemAttribute: ItemAttribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (filter: QueryFilterData) => void;
  draftQueryFilterData?: QueryFilterData;
}

function CollectionItemListDropdownFilter({
  itemAttribute,
  isBottomSheetVisible,
  onQueryFilterDataChange,
  draftQueryFilterData,
}: CollectionItemListDropdownFilterProps) {
  const [selectValue, setSelectValue] = useState<string | null>(null);
  const [dropDownIsOpen, setDropDownIsOpen] = useState(false);

  const { data: optionsData } = useGetSingleData<ItemOptions>(
    `${endpoints.itemOptions}`,
    `${querykeys.itemOptionsData}/${itemAttribute.attribute.itemOptionsId}`,
    `${itemAttribute.attribute.itemOptionsId}`
  );

  useEffect(() => {
    console.log(optionsData);
  }, [optionsData]);

  useEffect(() => {
    if (isBottomSheetVisible) {
      setSelectValue(
        (draftQueryFilterData?.value as string)?.split(";")[0] ?? null
      );
      setDropDownIsOpen(false);
    }
  }, [isBottomSheetVisible]);

  return (
    <CustomDropdown
      open={dropDownIsOpen}
      label={`${itemAttribute.attribute.name} select`}
      value={selectValue}
      setOpen={setDropDownIsOpen}
      setValue={(newValue) => {
        setSelectValue(newValue);
        onQueryFilterDataChange({
          filter: "Contains",
          field: nestedAttributeFilterQuery(
            itemAttribute.attributeId,
            "valueString"
          ),
          value: `${newValue};`,
        });
      }}
      items={getOptions(optionsData)}
    />
  );
}

export default CollectionItemListDropdownFilter;
