import { customTheme } from "@/src/theme/theme";
import CustomDropdownItem from "@/src/types/helpers/custom_dropdown_item";
import { useEffect, useState } from "react";
import {
  FlatList,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { ValueType } from "react-native-dropdown-picker";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomIconButton from "./custom_icon_button";
import CustomText from "./custom_text";
import CustomTextInput from "./custom_text_input";

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

function CustomAutocomplete<T extends ValueType>(
  props: CustomAutocompleteProps<T>,
) {
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
    dropDownContainerStyle,
    textStyle,
    errorMessage,
    additionalElementPlacement = "start",
    ...rest
  } = props;

  const [inputValue, setInputValue] = useState(value?.toString() ?? "");

  const filteredItems = items.filter((i) =>
    i.label?.toLowerCase().includes(inputValue.toLowerCase()),
  );

  useEffect(() => {
    setInputValue(value?.toString() ?? "");
  }, [open]);

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

      <TouchableOpacity onPress={() => setOpen(true)} disabled={disabled}>
        <CustomTextInput value={value?.toString() ?? ""} editable={false} />
      </TouchableOpacity>

      <Overlay
        fullScreen
        overlayStyle={{
          backgroundColor: customTheme.colors.secondary,
          margin: 0,
          padding: 0,
        }}
        isVisible={open ?? false}
        onBackdropPress={() => setOpen(false)}
      >
        <SafeAreaView>
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.label?.toString() ?? ""}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setInputValue(item.label ?? "");
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
                    {item.additionalElement &&
                    additionalElementPlacement === "end"
                      ? item.additionalElement
                      : null}
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListHeaderComponent={
              <View
                style={{
                  flexDirection: "column",
                  paddingHorizontal: 10,
                  borderBottomWidth: 1,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <CustomText>{modalTitle ?? ""}</CustomText>
                  <Text
                    onPress={() => setOpen(false)}
                    style={{
                      color: customTheme.colors.primary,
                      fontSize: 24,
                      fontWeight: "bold",
                    }}
                  >
                    ✕
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    gap: 10,
                    marginHorizontal: 5,
                  }}
                >
                  <CustomTextInput
                    value={inputValue}
                    onChangeText={(text) => {
                      setInputValue(text);
                    }}
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <CustomIconButton
                    iconName={"check"}
                    iconType={"entypo"}
                    color={customTheme.colors.primary}
                    reverseColor={customTheme.colors.secondary}
                    onPress={() => {
                      setValue(inputValue as unknown as T);
                      setOpen(false);
                    }}
                    size={16}
                    style={{ marginTop: 10 }}
                  />
                </View>
              </View>
            }
            stickyHeaderIndices={[0]}
            ListEmptyComponent={
              <CustomText
                style={{
                  textAlign: "center",
                  fontFamily: "VendSansItalic",
                  marginTop: 20,
                }}
              >
                This field supports custom values in addition to the suggested
                options.
              </CustomText>
            }
          />
        </SafeAreaView>
      </Overlay>

      {disabled && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 22,
            bottom: 22,
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

export default CustomAutocomplete;
