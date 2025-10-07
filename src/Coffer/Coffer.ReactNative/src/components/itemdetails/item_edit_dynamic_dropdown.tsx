import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import Attribute from "@/src/types/entities/attribute";
import ItemOptions from "@/src/types/entities/itemoptions";
import { getOptions } from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";
import CustomDropdown from "../custom_ui/custom_dropdown";

interface ItemEditDynamicDropdownProps {
  attribute: Attribute;
  defaultValue: string;
  onValueChange: (newValue: string | number | boolean) => void;
  onErrorChange: (errorMessage: string) => void;
}

function ItemEditDynamicDropdown({
  attribute,
  defaultValue,
  onValueChange,
  onErrorChange,
}: ItemEditDynamicDropdownProps) {
  const [selectValue, setSelectValue] = useState<string | null>(null);
  const [dropDownIsOpen, setDropDownIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { data: optionsData } = useGetSingleData<ItemOptions>(
    `${endpoints.itemOptions}`,
    `${querykeys.itemOptionsData}/${attribute.itemOptionsId}`,
    `${attribute.itemOptionsId}`
  );

  const checkInput = (newValue: string | null) => {
    let errorMessage = "";
    if (attribute.primary && newValue === null) {
      errorMessage = stringResource.requiredError;
    }
    setErrorMessage(errorMessage);
    onErrorChange(errorMessage);
  };

  useEffect(() => {
    const value = defaultValue?.split(";")[0] ?? null;
    setSelectValue(value);
    checkInput(value);
  }, [defaultValue]);

  return (
    <CustomDropdown
      open={dropDownIsOpen}
      label={attribute.name}
      value={selectValue}
      setOpen={setDropDownIsOpen}
      setValue={(newValue) => {
        const value = newValue ? `${newValue};` : null;
        checkInput(value);
        setSelectValue(newValue);
        onValueChange(value ?? "");
      }}
      items={getOptions(optionsData)}
      errorMessage={errorMessage}
    />
  );
}

export default ItemEditDynamicDropdown;
