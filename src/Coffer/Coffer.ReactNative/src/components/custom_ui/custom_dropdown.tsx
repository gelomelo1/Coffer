import CustomDropdownItem from "@/src/types/helpers/custom_dropdown_item";
import { colors } from "@/src/theme/theme";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TextStyle, View, ViewStyle } from "react-native";
import DropDownPicker, { ValueType } from "react-native-dropdown-picker";
import {
  disabledWrap,
  SelectError,
  SelectLabel,
  selectFieldStyle,
  selectModalProps,
  useSelectModalInsets,
  SelectOptionRow,
  selectTextStyle,
} from "./select_shared";

type CustomDropdownProps<T extends ValueType> = {
  label?: string;
  value: T | null;
  open?: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setValue: (value: T | null) => void;
  items: CustomDropdownItem<T>[];
  placeholder?: string;
  modalTitle?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  style?: ViewStyle;
  dropDownContainerStyle?: ViewStyle;
  textStyle?: TextStyle;
  errorMessage?: string;
  searchable?: boolean;
  additionalElementPlacement?: "start" | "end";
};

/** Single select. Opens a full-screen list; tapping the selected option (or "None") clears it. */
function CustomDropdown<T extends ValueType>(props: CustomDropdownProps<T>) {
  const { t } = useTranslation();
  const {
    label,
    open,
    setOpen,
    value,
    items,
    placeholder,
    modalTitle,
    setValue,
    disabled = false,
    containerStyle,
    labelStyle,
    style,
    dropDownContainerStyle,
    textStyle,
    errorMessage,
    searchable = false,
    additionalElementPlacement = "start",
    ...rest
  } = props;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const modalInsets = useSelectModalInsets();
  const isOpen = open ?? uncontrolledOpen;
  const setIsOpen = setOpen ?? setUncontrolledOpen;

  const dropdownItems: CustomDropdownItem<T>[] = [
    { label: t("common:actions.none"), value: undefined as unknown as T }, // special value: clear
    ...(items ?? []),
  ];

  return (
    <View style={[{ width: "100%", position: "relative", zIndex: 0 }, disabledWrap(disabled), containerStyle]}>
      <SelectLabel label={label} style={labelStyle} />

      <DropDownPicker<T>
        {...rest}
        {...selectModalProps}
        {...modalInsets}
        open={isOpen}
        searchable={searchable}
        setOpen={setIsOpen}
        value={value ?? null}
        items={dropdownItems}
        setValue={(callback) => {
          const newValue = callback(value);
          setValue(newValue === value ? null : newValue);
        }}
        multiple={false}
        style={[selectFieldStyle, errorMessage ? { borderColor: colors.danger } : null, style]}
        dropDownContainerStyle={[{ borderRadius: 0 }, dropDownContainerStyle]}
        textStyle={[selectTextStyle, textStyle]}
        disabled={disabled}
        modalTitle={modalTitle || label || t("common:actions.select")}
        placeholder={placeholder || t("common:actions.select")}
        placeholderStyle={{ color: colors.textMuted }}
        searchPlaceholder={t("common:actions.search")}
        translation={{ NOTHING_TO_SHOW: t("common:states.empty") }}
        renderListItem={({ item }: { item: CustomDropdownItem<T> }) => {
          const isNone = item.value === undefined;
          return (
            <SelectOptionRow
              label={item.label ?? ""}
              selected={!isNone && item.value === value}
              muted={isNone}
              additionalElement={item.additionalElement}
              additionalElementPlacement={additionalElementPlacement}
              onPress={() => {
                if (isNone) setValue(null);
                else setValue(item.value === value ? null : (item.value as T));
                setIsOpen(false);
              }}
            />
          );
        }}
      />

      <SelectError message={errorMessage} />
    </View>
  );
}

export default CustomDropdown;
