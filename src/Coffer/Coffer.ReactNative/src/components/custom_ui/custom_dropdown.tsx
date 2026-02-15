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

type CustomDropdownProps<T extends ValueType> = {
  label: string;
  value: T | null;
  open?: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setValue: React.Dispatch<React.SetStateAction<T | null>>;
  items: CustomDropdownItem<T>[];
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
    searchable = false,
    additionalElementPlacement = "start",
    ...rest
  } = props;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  return (
    <View
      style={[
        { width: "100%", position: "relative", zIndex: 0 },
        containerStyle,
      ]}
    >
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
        searchable={searchable}
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
        modalTitle="Select an option"
        placeholder="Select an option"
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
        renderListItem={({ item }: { item: CustomDropdownItem<T> }) => (
          <TouchableOpacity
            onPress={() => {
              setValue(
                (prev) => (prev === item.value ? null : item.value) as T,
              );
              setOpen(false);
            }}
          >
            <View
              style={{
                marginHorizontal: 10,
                marginBottom: 10,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {item.additionalElement &&
                additionalElementPlacement === "start"
                  ? item.additionalElement
                  : null}
                <Text
                  style={{
                    color: customTheme.colors.primary,
                    fontSize: 22,
                  }}
                >
                  {item.label}
                </Text>
                {item.additionalElement && additionalElementPlacement === "end"
                  ? item.additionalElement
                  : null}
              </View>
              {item.value === value ? (
                <Text
                  style={{
                    flexShrink: 0,
                    color: customTheme.colors.primary,
                    fontSize: 22,
                  }}
                >
                  ✓
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
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
