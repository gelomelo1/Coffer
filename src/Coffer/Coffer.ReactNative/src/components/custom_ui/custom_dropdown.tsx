import { customTheme } from "@/src/theme/theme";
import { useState } from "react";
import { Text, TextStyle, View, ViewStyle } from "react-native";
import DropDownPicker, { ValueType } from "react-native-dropdown-picker";
import CustomText from "./custom_text";

type CustomDropdownProps<T extends ValueType> = {
  label: string;
  value: T | null;
  open?: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setValue: React.Dispatch<React.SetStateAction<T | null>>;
  items: { label: string; value: T }[];
  disabled?: boolean;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  style?: ViewStyle;
  dropDownContainerStyle?: ViewStyle;
  textStyle?: TextStyle;
  errorMessage?: string;
};

function CustomDropdown<T extends ValueType>(props: CustomDropdownProps<T>) {
  const {
    label,
    open,
    setOpen,
    value,
    items,
    setValue,
    disabled = false,
    containerStyle,
    labelStyle,
    style,
    dropDownContainerStyle,
    textStyle,
    errorMessage,
    ...rest
  } = props;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  return (
    <View style={[{ width: "100%", position: "relative" }, containerStyle]}>
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

      <DropDownPicker<T>
        {...rest}
        open={open ?? uncontrolledOpen}
        setOpen={setOpen ?? setUncontrolledOpen}
        value={value ?? null}
        items={items ?? []}
        setValue={(callback) => {
          const newValue = callback(value);

          if (newValue === value) {
            setValue(null);
          } else {
            setValue(newValue);
          }
        }}
        multiple={false}
        listMode="SCROLLVIEW"
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

export default CustomDropdown;
