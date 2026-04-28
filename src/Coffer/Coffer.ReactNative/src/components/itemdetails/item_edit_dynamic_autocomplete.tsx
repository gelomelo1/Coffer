import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import { useGetSingleData } from "@/src/hooks/data_hooks";
import Attribute from "@/src/types/entities/attribute";
import ItemOptions from "@/src/types/entities/itemoptions";
import { getOptions } from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";
import CustomAutocomplete from "../custom_ui/custom_autocomplete";

interface ItemEditDynamicAutocompleteProps {
  attribute: Attribute;
  defaultValue: string;
  onValueChange: (newValue: string | number | boolean) => void;
  onErrorChange: (errorMessage: string) => void;
}

function ItemEditDynamicAutocomplete({
  attribute,
  defaultValue,
  onValueChange,
  onErrorChange,
}: ItemEditDynamicAutocompleteProps) {
  const [selectValue, setSelectValue] = useState<string | null>(null);
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
    const value = defaultValue;
    setSelectValue(value);
    console.log(typeof value);
    checkInput(value);
  }, [defaultValue]);

  return (
    <CustomAutocomplete
      open={dropDownIsOpen}
      label={attribute.name}
      value={selectValue}
      setOpen={setDropDownIsOpen}
      setValue={(newValue) => {
        const value = newValue ? newValue : null;
        checkInput(value);
        setSelectValue(newValue);
        onValueChange(value ?? "");
      }}
      items={getOptions(optionsData)}
      errorMessage={errorMessage}
    />
  );
}

export default ItemEditDynamicAutocomplete;
