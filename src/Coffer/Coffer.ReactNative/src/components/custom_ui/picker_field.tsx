import { colors, sizes, spacing } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import { SelectError, SelectLabel, selectFieldStyle, selectTextStyle } from "./select_shared";

interface PickerFieldProps {
  label?: string;
  value?: string | null;
  placeholder: string;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
  onPress: () => void;
  errorMessage?: string;
  disabled?: boolean;
}

/** Field-looking button that opens a native picker (date, month, …). */
export function PickerField({ label, value, placeholder, icon = "event", onPress, errorMessage, disabled = false }: PickerFieldProps) {
  return (
    <View style={{ width: "100%", opacity: disabled ? 0.5 : 1 }}>
      <SelectLabel label={label} />
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value ?? "" }}
        style={({ pressed }) => [
          selectFieldStyle,
          { flexDirection: "row", alignItems: "center", gap: spacing.xs },
          errorMessage ? { borderColor: colors.danger } : null,
          pressed && { backgroundColor: colors.surfaceAlt },
        ]}
      >
        <MaterialIcons name={icon} size={sizes.iconSm} color={colors.text} />
        <Text style={[selectTextStyle, { flex: 1 }, !value && { color: colors.textMuted }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </Pressable>
      <SelectError message={errorMessage} />
    </View>
  );
}

export default PickerField;
