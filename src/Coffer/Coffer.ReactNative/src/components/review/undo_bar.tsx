import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

/** "Added Heineken · UNDO" for the 5 seconds an action is held. Announced politely; never steals focus. */
function UndoBar({ label, onUndo }: { label: string; onUndo: () => void }) {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
        paddingLeft: spacing.md,
        backgroundColor: colors.text,
        borderWidth: borders.width,
        borderColor: colors.border,
      }}
    >
      <Text style={[typography.body, { color: colors.bg, flex: 1, paddingVertical: spacing.sm }]} numberOfLines={2}>
        {label}
      </Text>
      <Pressable onPress={onUndo} accessibilityRole="button" accessibilityLabel={t("items:review.undo")} style={{ minHeight: 48, minWidth: 64, paddingHorizontal: spacing.md, alignItems: "center", justifyContent: "center" }}>
        <Text style={[typography.label, { color: colors.secondary }]}>{t("items:review.undo").toUpperCase()}</Text>
      </Pressable>
    </View>
  );
}

export default UndoBar;
