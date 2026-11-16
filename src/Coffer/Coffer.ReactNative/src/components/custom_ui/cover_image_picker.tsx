import { borders, colors, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image, Pressable, Text, View } from "react-native";
import CustomButton from "./custom_button";
import { ComponentLoading } from "./loading";

interface CoverImagePickerProps {
  label: string;
  emptyText: string;
  changeLabel: string;
  removeLabel: string;
  uri: string | null;
  headers?: Record<string, string>;
  loading?: boolean;
  size?: number;
  onPick: () => void;
  onRemove: () => void;
}

/** Square image slot with a change and a remove action (collection cover). */
export function CoverImagePicker({ label, emptyText, changeLabel, removeLabel, uri, headers, loading = false, size = 160, onPick, onRemove }: CoverImagePickerProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center", flexWrap: "wrap" }}>
        <Pressable
          onPress={onPick}
          accessibilityRole="button"
          accessibilityLabel={changeLabel}
          style={{
            width: size,
            height: size,
            borderWidth: borders.width,
            borderColor: colors.border,
            borderStyle: uri ? "solid" : "dashed",
            backgroundColor: colors.surfaceAlt,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {uri ? (
            <Image source={{ uri, headers, cache: "reload" }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <View style={{ alignItems: "center", gap: spacing.xxs, padding: spacing.sm }}>
              <MaterialIcons name="add-photo-alternate" size={36} color={colors.text} />
              <Text style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}>{emptyText}</Text>
            </View>
          )}
          {loading ? <ComponentLoading /> : null}
        </Pressable>
        <View style={{ flex: 1, minWidth: 140, gap: spacing.sm }}>
          <CustomButton title={changeLabel} variant="outline" size="sm" onPress={onPick} icon={<MaterialIcons name="image" size={18} color={colors.text} />} />
          {uri ? (
            <CustomButton title={removeLabel} variant="ghost" size="sm" onPress={onRemove} titleStyle={{ color: colors.danger }} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default CoverImagePicker;
