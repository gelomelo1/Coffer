import { languageFilter, textInputRegex } from "@/src/const/filter";
import { stringResource } from "@/src/const/resource";
import Attribute from "@/src/types/entities/attribute";
import { useEffect, useState } from "react";
import CustomTextInput from "../custom_ui/custom_text_input";

interface ItemEditTextFieldProps<T extends string | number> {
  attribute: Attribute;
  defaultValue: T;
  onValueChange: (newValue: string | number | boolean) => void;
  onErrorChange: (errorMessage: string) => void;
}

function ItemEditTextField<T extends string | number>({
  attribute,
  defaultValue,
  onValueChange,
  onErrorChange,
}: ItemEditTextFieldProps<T>) {
  const [text, setText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const checkInput = (newValue: string) => {
    let errorMessage = "";
    if (newValue === "") {
      errorMessage = stringResource.requiredError;
    } else if (!textInputRegex.test(newValue)) {
      errorMessage = stringResource.textInputRegexError;
    } else if (languageFilter.isProfane(newValue)) {
      errorMessage = stringResource.profaneError;
    }
    setErrorMessage(errorMessage);
    onErrorChange(errorMessage);
  };

  useEffect(() => {
    const value = defaultValue.toString() ?? "";
    setText(value);
    checkInput(value);
  }, [defaultValue]);

  if (typeof defaultValue === "string")
    return (
      <CustomTextInput
        label={`${attribute.name}`}
        defaultValue={text}
        onChangeText={(newValue) => {
          checkInput(newValue);
          setText(newValue);
          onValueChange(newValue as string);
        }}
        errorMessage={errorMessage}
      />
    );

  return (
    <CustomTextInput
      label={`${attribute.name}`}
      defaultValue={text}
      onChangeText={(newValue) => {
        const numericValue = newValue === "" ? 0 : Number(newValue);
        checkInput(newValue);
        setText(newValue);
        onValueChange(numericValue as T);
      }}
      keyboardType="numeric"
      errorMessage={errorMessage}
    />
  );
}

export default ItemEditTextField;
