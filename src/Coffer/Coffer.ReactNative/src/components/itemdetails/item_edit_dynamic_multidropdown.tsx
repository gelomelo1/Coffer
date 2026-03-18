import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import Attribute from "@/src/types/entities/attribute";
import ItemOptions from "@/src/types/entities/itemoptions";
import { getOptions } from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";
import CustomDropdownMultiple from "../custom_ui/custom_dropdown_multiple";

interface ItemEditDynamicMultiDropdownProps {
  attribute: Attribute;
  defaultValue: string;
  onValueChange: (newValue: string | number | boolean) => void;
  onErrorChange: (errorMessage: string) => void;
}

function ItemEditMultiDynamicDropdown({
  attribute,
  defaultValue,
  onValueChange,
  onErrorChange,
}: ItemEditDynamicMultiDropdownProps) {
  const [selectValue, setSelectValue] = useState<string[]>([]);
  const [dropDownIsOpen, setDropDownIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: optionsData } = useGetSingleData<ItemOptions>(
    `${endpoints.itemOptions}`,
    `${querykeys.itemOptionsData}/${attribute.itemOptionsId}`,
    `${attribute.itemOptionsId}`,
  );

  const checkInput = (newValue: string | null) => {
    let errorMessage = "";
    if (newValue === null) {
      errorMessage = stringResource.requiredError;
    }
    setErrorMessage(errorMessage);
    onErrorChange(errorMessage);
  };

  useEffect(() => {
    const value = defaultValue?.split(";").slice(0, -1);
    setSelectValue(value);
    console.log(typeof value);
    checkInput(defaultValue);
  }, [defaultValue]);

  return (
    <CustomDropdownMultiple
      open={dropDownIsOpen}
      label={attribute.name}
      value={selectValue}
      setOpen={setDropDownIsOpen}
      setValue={(newValue) => {
        const value = newValue ? `${newValue.join(";")};` : null;
        checkInput(value);
        setSelectValue(newValue ?? []);
        onValueChange(value ?? "");
      }}
      items={getOptions(optionsData)}
      errorMessage={errorMessage}
      searchable
    />
  );
}

export default ItemEditMultiDynamicDropdown;
