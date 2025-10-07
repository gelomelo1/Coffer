import { stringResource } from "@/src/const/resource";
import Attribute from "@/src/types/entities/attribute";
import { useEffect, useState } from "react";
import { TouchableOpacity } from "react-native";
import MonthPicker from "react-native-month-year-picker";
import CustomTextInput from "../custom_ui/custom_text_input";

interface ItemEditDynamicDateProps {
  attribute: Attribute;
  defaultValue: string;
  onValueChange: (newValue: string | number | boolean) => void;
  onErrorChange: (errorMessage: string) => void;
}

function ItemEditDynamicDate({
  attribute,
  defaultValue,
  onValueChange,
  onErrorChange,
}: ItemEditDynamicDateProps) {
  const [date, setDate] = useState<Date | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const checkInput = (newValue: Date | undefined | null) => {
    let errorMessage = "";
    if (attribute.primary && !newValue) {
      errorMessage = stringResource.requiredError;
    }
    setErrorMessage(errorMessage);
    onErrorChange(errorMessage);
  };

  const handleDatePickerInput = () => {
    setIsDatePickerOpen(true);
  };

  useEffect(() => {
    const value = defaultValue ? new Date(defaultValue) : null;
    setDate(value);
    checkInput(value);
  }, [defaultValue]);

  const handleDateChange = (newValue?: Date) => {
    checkInput(newValue);
    if (newValue) {
      setDate(newValue);
      onValueChange(newValue.toISOString());
    }
    setIsDatePickerOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        style={{ width: "100%" }}
        onPress={() => handleDatePickerInput()}
      >
        <CustomTextInput
          label={`${attribute.name} date`}
          editable={false}
          value={date?.toLocaleDateString() ?? ""}
          errorMessage={errorMessage}
        />
      </TouchableOpacity>
      {isDatePickerOpen ? (
        <MonthPicker
          value={date ?? new Date()}
          onChange={(event, newDate) => handleDateChange(newDate)}
        />
      ) : null}
    </>
  );
}

export default ItemEditDynamicDate;
