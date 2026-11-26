import { borders, colors, spacing } from "@/src/theme/theme";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ImagePickerAsset } from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { Image, Pressable, View } from "react-native";

/** Picked photos as a 3-column grid, each with a remove button; optional empty slots show how many a form takes. */
export function PhotoGrid({ photos, slots = 0, onRemove }: { photos: ImagePickerAsset[]; slots?: number; onRemove: (index: number) => void }) {
  const { t } = useTranslation();
  const empty = Math.max(0, slots - photos.length);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
      {photos.map((photo, i) => (
        <View key={photo.uri + i} style={{ width: "31.5%", aspectRatio: 1, borderWidth: borders.width, borderColor: colors.border }}>
          <Image source={{ uri: photo.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityIgnoresInvertColors />
          <Pressable
            onPress={() => onRemove(i)}
            accessibilityRole="button"
            accessibilityLabel={t("community:shape.detection.remove", { index: i + 1 })}
            hitSlop={8}
            style={({ pressed }) => ({
              position: "absolute", top: 2, right: 2, width: 36, height: 36, alignItems: "center", justifyContent: "center",
              backgroundColor: pressed ? colors.danger : colors.primary, borderWidth: borders.hairline, borderColor: colors.onPrimary,
            })}
          >
            <MaterialCommunityIcons name="close" size={20} color={colors.onPrimary} />
          </Pressable>
        </View>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <View
          key={`empty-${i}`}
          importantForAccessibility="no"
          style={{ width: "31.5%", aspectRatio: 1, borderWidth: borders.width, borderStyle: "dashed", borderColor: colors.borderMuted, alignItems: "center", justifyContent: "center" }}
        >
          <MaterialCommunityIcons name="camera-plus-outline" size={24} color={colors.borderMuted} />
        </View>
      ))}
    </View>
  );
}
