import { borders, colors, fonts, sizes, spacing } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { useTranslation } from "react-i18next";
import { FlatListProps, Platform, Pressable, Text, View } from "react-native";
import CountryPicker, { Country, CountryCode, Flag } from "react-native-country-picker-modal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomTextInput from "./custom_text_input";
import { SelectError, SelectLabel, selectFieldStyle, selectTextStyle } from "./select_shared";

/** Country picker theme built from Coffer tokens. */
export const countryPickerTheme = {
  primaryColor: colors.text,
  primaryColorVariant: colors.borderMuted, // list separators
  backgroundColor: colors.bg,
  onBackgroundTextColor: colors.text,
  fontSize: 16,
  fontFamily: fonts.regular,
  filterPlaceholderTextColor: colors.textMuted,
  activeOpacity: 0.6,
  itemHeight: 56,
  flagSize: 24,
  flagSizeButton: 24,
};

interface CountryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (country: Country) => void;
  /** Shown first in the list so the current choice is easy to find. */
  selectedCode?: CountryCode | null;
  withCallingCode?: boolean;
}

/** The themed full-screen country list with a Coffer search field and close button. */
export function CountryPickerModal({ visible, onClose, onSelect, selectedCode, withCallingCode = false }: CountryPickerModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <CountryPicker
      countryCode={(selectedCode ?? "HU") as CountryCode}
      visible={visible}
      onClose={onClose}
      onSelect={(c) => {
        onSelect(c);
        onClose();
      }}
      theme={countryPickerTheme}
      translation="common"
      withFilter
      withFlag
      withEmoji
      withAlphaFilter={false}
      withCallingCode={withCallingCode}
      withCloseButton={false}
      preferredCountries={selectedCode ? [selectedCode] : undefined}
      renderFlagButton={() => null}
      modalProps={{ animationType: "slide", onRequestClose: onClose }}
      // The library supplies data/renderItem; these are only extra FlatList options.
      flatListProps={
        {
          keyboardShouldPersistTaps: "handled",
          keyboardDismissMode: "on-drag",
          contentContainerStyle: { paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.sm },
        } as unknown as FlatListProps<Country>
      }
      renderCountryFilter={(props) => (
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingLeft: spacing.md,
            paddingRight: spacing.xxs,
            paddingBottom: spacing.sm,
            // The library's SafeAreaView only pads on iOS; the Android modal is edge-to-edge.
            paddingTop: spacing.sm + (Platform.OS === "android" ? insets.top : 0),
            borderBottomWidth: borders.width,
            borderBottomColor: colors.border,
          }}
        >
          <CustomTextInput
            variant="search"
            value={props.value}
            onChangeText={props.onChangeText}
            onClear={() => props.onChangeText?.("")}
            autoFocus={props.autoFocus}
            placeholder={t("common:country.searchPlaceholder")}
            accessibilityLabel={t("common:country.searchPlaceholder")}
            autoCorrect={false}
            returnKeyType="search"
            style={{ flex: 1 }}
          />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("accessibility:close")}
            style={({ pressed }) => ({ width: sizes.touch, height: sizes.touch, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
          >
            <MaterialIcons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
      )}
    />
  );
}

interface CountryFieldProps {
  label?: string;
  value?: Country | null;
  onSelect: (country: Country) => void;
  placeholder?: string;
  errorMessage?: string;
  disabled?: boolean;
  withCallingCode?: boolean;
}

/** Form field: flag + country name (wraps on narrow screens) that opens CountryPickerModal. */
export function CountryField({ label, value, onSelect, placeholder, errorMessage, disabled = false, withCallingCode }: CountryFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const name = value ? (typeof value.name === "string" ? value.name : value.name.common) : null;

  return (
    <View style={{ width: "100%", opacity: disabled ? 0.5 : 1 }}>
      <SelectLabel label={label} />
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ?? t("common:country.label")}
        accessibilityValue={{ text: name ?? "" }}
        style={({ pressed }) => [
          selectFieldStyle,
          { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
          errorMessage ? { borderColor: colors.danger } : null,
          pressed && { backgroundColor: colors.surfaceAlt },
        ]}
      >
        {value ? <Flag countryCode={value.cca2} withEmoji flagSize={24} /> : <MaterialIcons name="public" size={sizes.iconMd} color={colors.textMuted} />}
        <Text numberOfLines={2} style={[selectTextStyle, { flex: 1 }, !name && { color: colors.textMuted }]}>
          {name ?? placeholder ?? t("common:country.placeholder")}
        </Text>
        <MaterialIcons name="expand-more" size={sizes.iconMd} color={colors.text} />
      </Pressable>
      <SelectError message={errorMessage} />
      <CountryPickerModal
        visible={open}
        onClose={() => setOpen(false)}
        onSelect={onSelect}
        selectedCode={value?.cca2}
        withCallingCode={withCallingCode}
      />
    </View>
  );
}

export default CountryField;
