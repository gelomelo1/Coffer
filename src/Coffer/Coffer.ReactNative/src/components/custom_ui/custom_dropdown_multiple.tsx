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

type CustomDropdownMultipleProps<T extends ValueType> = {
  label?: string;
  value: T[] | null;
  open?: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setValue: (value: T[] | null) => void;
  items: CustomDropdownItem<T>[];
  placeholder?: string;
  modalTitle?: string;
  multipleText?: string;
  onClose?: () => void;
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

/** Multi select. "None" clears the selection; the field shows the count text when several are chosen. */
function CustomDropdownMultiple<T extends ValueType>(props: CustomDropdownMultipleProps<T>) {
  const { t } = useTranslation();
  const {
    label,
    open,
    setOpen,
    value,
    items,
    placeholder,
    modalTitle,
    multipleText,
    onClose,
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

  const dropdownItems: CustomDropdownItem<T>[] = [
    { label: t("common:actions.none"), value: undefined as unknown as T }, // special value: clear all
    ...(items ?? []),
  ];

  return (
    <View style={[{ width: "100%", position: "relative", zIndex: 0 }, disabledWrap(disabled), containerStyle]}>
      <SelectLabel label={label} style={labelStyle} />

      <DropDownPicker<T>
        {...rest}
        {...selectModalProps}
        {...modalInsets}
        open={open ?? uncontrolledOpen}
        searchable={searchable}
        setOpen={setOpen ?? setUncontrolledOpen}
        onClose={onClose ? () => onClose() : undefined}
        value={value}
        items={dropdownItems}
        setValue={(callback) => setValue(callback(value))}
        multiple={true}
        style={[selectFieldStyle, errorMessage ? { borderColor: colors.danger } : null, style]}
        dropDownContainerStyle={[{ borderRadius: 0 }, dropDownContainerStyle]}
        textStyle={[selectTextStyle, textStyle]}
        disabled={disabled}
        modalTitle={modalTitle || label || t("common:select.multipleTitle")}
        placeholder={placeholder || t("common:select.multipleTitle")}
        placeholderStyle={{ color: colors.textMuted }}
        multipleText={multipleText || t("common:select.selectedCount", { count: value?.length ?? 0 })}
        searchPlaceholder={t("common:actions.search")}
        translation={{ NOTHING_TO_SHOW: t("common:states.empty") }}
        renderListItem={({ item }: { item: CustomDropdownItem<T> }) => {
          const isNone = item.value === undefined;
          const isSelected = Array.isArray(value) && (isNone ? value.length === 0 : value.includes(item.value!));
          return (
            <SelectOptionRow
              label={item.label ?? ""}
              selected={isSelected}
              muted={isNone}
              additionalElement={item.additionalElement}
              additionalElementPlacement={additionalElementPlacement}
              onPress={() => {
                if (isNone) return setValue([]);
                setValue(
                  value?.includes(item.value!) ? value.filter((v) => v !== item.value!) : [...(value ?? []), item.value!],
                );
              }}
            />
          );
        }}
      />

      <SelectError message={errorMessage} />
    </View>
  );
}

export default CustomDropdownMultiple;
