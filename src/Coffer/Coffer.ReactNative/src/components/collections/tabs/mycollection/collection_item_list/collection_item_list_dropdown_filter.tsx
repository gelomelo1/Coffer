import CustomDropdownMultiple from "@/src/components/custom_ui/custom_dropdown_multiple";
import { endpoints } from "@/src/const/endpoints";
import { nestedAttributeFilterQuery } from "@/src/const/filter";
import { querykeys } from "@/src/const/querykeys";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import Attribute from "@/src/types/entities/attribute";
import ItemOptions from "@/src/types/entities/itemoptions";
import { QueryFilterDataItem } from "@/src/types/helpers/attribute_data";
import {
  QueryFilterData,
  QueryFilterNode,
} from "@/src/types/helpers/query_data";
import { getOptions } from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";

interface CollectionItemListDropdownFilterProps {
  attribute: Attribute;
  isBottomSheetVisible: boolean;
  onQueryFilterDataChange: (
    filter?: QueryFilterData,
    id?: string | number,
    filterTree?: QueryFilterNode,
  ) => void;
  draftQueryFilterData?: QueryFilterDataItem;
}

function CollectionItemListDropdownFilter({
  attribute,
  isBottomSheetVisible,
  onQueryFilterDataChange,
  draftQueryFilterData,
}: CollectionItemListDropdownFilterProps) {
  const [selectValue, setSelectValue] = useState<string[] | null>([]);
  const [dropDownIsOpen, setDropDownIsOpen] = useState(false);

  const { data: optionsData } = useGetSingleData<ItemOptions>(
    `${endpoints.itemOptions}`,
    `${querykeys.itemOptionsData}/${attribute.itemOptionsId}`,
    `${attribute.itemOptionsId}`,
  );

  useEffect(() => {
    if (isBottomSheetVisible) {
      const tree = draftQueryFilterData?.filterTree;

      const values =
        tree && "filters" in tree
          ? tree.filters
              .map((f) => {
                if ("value" in f && typeof f.value === "string") {
                  return f.value.replace(";", "");
                }
                return undefined;
              })
              .filter((v): v is string => v !== undefined)
          : null;

      setSelectValue(values);
      setDropDownIsOpen(false);
    }
  }, [isBottomSheetVisible]);

  return (
    <CustomDropdownMultiple
      open={dropDownIsOpen}
      label={`${attribute.name} select`}
      value={selectValue}
      setOpen={setDropDownIsOpen}
      setValue={(newValue) => {
        setSelectValue(newValue);
        /*onQueryFilterDataChange({
          filter: "Contains",
          field: nestedAttributeFilterQuery(attribute.id, "valueString"),
          value: `${newValue};`,
        });
      }}*/
        if (newValue === null || newValue.length === 0) {
          onQueryFilterDataChange(undefined, undefined, undefined);
        } else {
          console.log(newValue);
          onQueryFilterDataChange(undefined, undefined, {
            conjunction: "OR",
            filters: newValue.map((value) => ({
              filter: "Contains",
              field: nestedAttributeFilterQuery(attribute.id, "valueString"),
              value: `${value};`,
            })),
          });
        }
      }}
      items={getOptions(optionsData)}
      searchable
    />
  );
}

export default CollectionItemListDropdownFilter;
