import { stringResource } from "@/src/const/resource";
import Attribute from "@/src/types/entities/attribute";
import { useEffect, useState } from "react";
import MonthPicker from "react-native-month-year-picker";
import PickerField from "../custom_ui/picker_field";
import { useTranslation } from "react-i18next";

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
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState<Date | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const checkInput = (newValue: Date | undefined | null) => {
    let errorMessage = "";
    if (!newValue) {
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
      <PickerField
        label={attribute.name}
        value={date ? date.toLocaleDateString(i18n.language) : null}
        placeholder={t("items:edit.pickDate")}
        onPress={() => handleDatePickerInput()}
        errorMessage={errorMessage}
      />
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
