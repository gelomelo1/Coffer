import { colors, sizes, spacing, typography } from "@/src/theme/theme";
import CustomDropdownItem from "@/src/types/helpers/custom_dropdown_item";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, Text, TextStyle, View, ViewStyle } from "react-native";
import { ValueType } from "react-native-dropdown-picker";
import CustomButton from "./custom_button";
import CustomTextInput from "./custom_text_input";
import { disabledWrap, SelectError, SelectLabel, selectFieldStyle, SelectOptionRow, selectTextStyle } from "./select_shared";
import SheetModal from "./sheet_modal";

type CustomAutocompleteProps<T extends ValueType> = {
  label?: string;
  value: T | null;
  open?: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setValue: (value: T | null) => void;
  items: CustomDropdownItem<T>[];
  modalTitle?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  style?: ViewStyle;
  dropDownContainerStyle?: ViewStyle;
  textStyle?: TextStyle;
  errorMessage?: string;
  additionalElementPlacement?: "start" | "end";
};

/** Free-text value with suggestions: type anything or pick a suggestion, then confirm. */
function CustomAutocomplete<T extends ValueType>(props: CustomAutocompleteProps<T>) {
  const { t } = useTranslation();
  const {
    label,
    open,
    setOpen,
    value,
    items,
    modalTitle,
    setValue,
    disabled = false,
    containerStyle,
    labelStyle,
    style,
    textStyle,
    errorMessage,
    additionalElementPlacement = "start",
  } = props;

  const [inputValue, setInputValue] = useState(value?.toString() ?? "");

  const filteredItems = items.filter((i) => i.label?.toLowerCase().includes(inputValue.toLowerCase()));

  useEffect(() => {
    setInputValue(value?.toString() ?? "");
  }, [open, value]);

  const confirm = () => {
    setValue(inputValue as unknown as T);
    setOpen(false);
  };

  return (
    <View style={[{ width: "100%" }, disabledWrap(disabled), containerStyle]}>
      <SelectLabel label={label} style={labelStyle} />

      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value?.toString() ?? "" }}
        style={[
          selectFieldStyle,
          { flexDirection: "row", alignItems: "center", gap: spacing.xs },
          errorMessage ? { borderColor: colors.danger } : null,
          style,
        ]}
      >
        <Text style={[selectTextStyle, { flex: 1 }, !value && { color: colors.textMuted }, textStyle]} numberOfLines={2}>
          {value?.toString() || t("common:actions.select")}
        </Text>
        <MaterialIcons name="edit" size={sizes.iconSm} color={colors.text} />
      </Pressable>

      <SelectError message={errorMessage} />

      <SheetModal visible={open ?? false} onClose={() => setOpen(false)} title={modalTitle ?? label ?? ""}>
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <CustomTextInput
            value={inputValue}
            onChangeText={setInputValue}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirm}
            onClear={() => setInputValue("")}
            variant="search"
            accessibilityLabel={label}
          />
          <CustomButton title={t("common:actions.done")} onPress={confirm} />
        </View>
        <FlatList
          data={filteredItems}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.label?.toString() ?? ""}
          renderItem={({ item }) => (
            <SelectOptionRow
              label={item.label ?? ""}
              selected={item.label === inputValue}
              additionalElement={item.additionalElement}
              additionalElementPlacement={additionalElementPlacement}
              onPress={() => setInputValue(item.label ?? "")}
            />
          )}
          ListEmptyComponent={
            <Text style={[typography.meta, { color: colors.textMuted, textAlign: "center", padding: spacing.lg }]}>
              {t("common:autocomplete.customValueHint")}
            </Text>
          }
        />
      </SheetModal>
    </View>
  );
}

export default CustomAutocomplete;
