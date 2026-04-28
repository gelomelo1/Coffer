import { customTheme } from "@/src/theme/theme";
import CustomDropdownItem from "@/src/types/helpers/custom_dropdown_item";
import { useState } from "react";
import {
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import DropDownPicker, { ValueType } from "react-native-dropdown-picker";
import CustomText from "./custom_text";

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

function CustomDropdownMultiple<T extends ValueType>(
  props: CustomDropdownMultipleProps<T>,
) {
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

  const dropdownItems: CustomDropdownItem<T>[] = [
    {
      label: "None",
      value: undefined as unknown as T, // special value to represent "clear all"
    },
    ...(items ?? []),
  ];

  return (
    <View
      style={[
        { width: "100%", position: "relative", zIndex: 0 },
        containerStyle,
      ]}
    >
      {label ? (
        <Text
          style={[
            {
              fontSize: 16,
              fontWeight: "bold",
              color: customTheme.colors.primary,
              marginBottom: 2,
              fontFamily: "VendSansBold",
            },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      ) : null}

      <DropDownPicker<T>
        {...rest}
        open={open ?? uncontrolledOpen}
        searchable={searchable}
        setOpen={setOpen ?? setUncontrolledOpen}
        onClose={onClose ? () => onClose() : undefined}
        value={value}
        items={dropdownItems}
        setValue={(callback) => {
          const newValue = callback(value);
          setValue(newValue);
        }}
        multiple={true}
        listMode="MODAL"
        style={[
          {
            backgroundColor: customTheme.colors.secondary,
            borderWidth: 2,
            borderRadius: 0,
            borderColor: customTheme.colors.primary,
            boxShadow: `1px 1px ${customTheme.colors.primary}`,
          },
          style,
        ]}
        dropDownContainerStyle={[
          {
            backgroundColor: customTheme.colors.secondary,
            borderWidth: 1,
            borderRadius: 0,
            borderColor: customTheme.colors.primary,
          },
          dropDownContainerStyle,
        ]}
        textStyle={[
          {
            color: customTheme.colors.primary,
            fontFamily: "VendSans",
            fontSize: 18,
          },
          textStyle,
        ]}
        disabledStyle={{
          borderWidth: 0,
          boxShadow: "none",
        }}
        disabled={disabled}
        modalAnimationType="slide"
        modalTitle={modalTitle || "Select options"}
        placeholder={placeholder || "Select options"}
        multipleText={multipleText || undefined}
        modalContentContainerStyle={{
          backgroundColor: customTheme.colors.secondary,
          paddingTop: 50,
        }}
        modalTitleStyle={{
          color: customTheme.colors.primary,
          fontSize: 24,
          fontWeight: "bold",
        }}
        searchPlaceholderTextColor={customTheme.colors.primary}
        searchTextInputStyle={{
          color: customTheme.colors.primary,
          borderColor: customTheme.colors.primary,
        }}
        CloseIconComponent={() => (
          <Text
            style={{
              color: customTheme.colors.primary,
              fontSize: 24,
              fontWeight: "bold",
            }}
          >
            ✕
          </Text>
        )}
        renderListItem={({ item }: { item: CustomDropdownItem<T> }) => {
          const isNone = item.value === undefined;
          const isSelected =
            Array.isArray(value) &&
            (isNone ? value.length === 0 : value.includes(item.value!));

          return (
            <TouchableOpacity
              onPress={() => {
                if (isNone) return setValue([]);
                setValue(
                  value?.includes(item.value!)
                    ? value.filter((v) => v !== item.value!)
                    : [...(value ?? []), item.value!],
                );
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginHorizontal: 10,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {item.additionalElement &&
                  additionalElementPlacement === "start"
                    ? item.additionalElement
                    : null}
                  <Text
                    style={{ color: customTheme.colors.primary, fontSize: 22 }}
                  >
                    {item.label}
                  </Text>
                  {item.additionalElement &&
                  additionalElementPlacement === "end"
                    ? item.additionalElement
                    : null}
                </View>
                {isSelected && (
                  <Text
                    style={{ color: customTheme.colors.primary, fontSize: 22 }}
                  >
                    ✓
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {disabled && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 22,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: customTheme.colors.disabledOverlay,
            zIndex: 9999,
          }}
        />
      )}

      {errorMessage && (
        <CustomText
          style={{
            color: "red",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {errorMessage}
        </CustomText>
      )}
    </View>
  );
}

export default CustomDropdownMultiple;
