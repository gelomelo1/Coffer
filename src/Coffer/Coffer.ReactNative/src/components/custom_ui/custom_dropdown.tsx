import { customTheme } from "@/src/theme/theme";
import { useState } from "react";
import { Text, TextStyle, View, ViewStyle } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";

type CustomDropdownProps = {
  label: string;
  value: string | null;
  open?: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setValue: React.Dispatch<React.SetStateAction<string | null>>;
  items: { label: string; value: string }[];
  disabled?: boolean;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  style?: ViewStyle;
  dropDownContainerStyle?: ViewStyle;
  textStyle?: TextStyle;
};

function CustomDropdown(props: CustomDropdownProps) {
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
    ...rest
  } = props;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  return (
    <View style={[{ width: "100%", position: "relative" }, containerStyle]}>
      {/* Label */}
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

      {/* Dropdown */}
      <DropDownPicker
        {...rest}
        open={open ?? uncontrolledOpen}
        setOpen={setOpen ?? setUncontrolledOpen}
        value={value ?? null}
        items={items ?? []}
        setValue={setValue}
        multiple={false}
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

      {/* Disabled overlay */}
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
            zIndex: 9999, // make sure overlay is above everything
          }}
        />
      )}
    </View>
  );
}

export default CustomDropdown;
