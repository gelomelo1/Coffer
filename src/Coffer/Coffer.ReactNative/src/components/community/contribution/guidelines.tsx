import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { ContributionForm } from "@/src/types/entities/contribution";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

/** The tips of each form, in the order shown (texts under community:shape.guidelines.<form>.<key>). */
const TIPS: Record<ContributionForm, string[]> = {
  classification: ["angles", "lighting", "background", "consistent", "distance", "tilts", "think"],
  detection: ["differentItems", "multiple", "distance", "background", "lighting", "tilts", "negatives", "important"],
};

/** The photo guidelines of a form: intro and tips with bold lead words. */
export function GuidelinesText({ form }: { form: ContributionForm }) {
  const { t } = useTranslation();
  const intro = form === "detection" ? [t("community:shape.guidelines.detection.intro"), t("community:shape.guidelines.detection.intro2")] : [t("community:shape.guidelines.classification.intro")];
  return (
    <View style={{ gap: spacing.sm }}>
      {intro.map((text, i) => (
        <Text key={i} style={[typography.body, { color: colors.text }]}>
          {text}
        </Text>
      ))}
      {TIPS[form].map((key) => (
        <Text key={key} style={[typography.body, { color: colors.text }]}>
          <Text style={typography.bodyStrong}>{t(`community:shape.guidelines.${form}.${key}.title` as any)}: </Text>
          {t(`community:shape.guidelines.${form}.${key}.text` as any)}
        </Text>
      ))}
    </View>
  );
}

/** Collapsible guidelines on the upload screens. */
export function Guidelines({ form, open, onToggle }: { form: ContributionForm; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? t("community:shape.guidelines.hide") : t("community:shape.guidelines.show")}
        style={({ pressed }) => ({
          minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md,
          backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        })}
      >
        <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={colors.secondary} />
        <Text style={[typography.label, { color: colors.text, flex: 1 }]}>{t("community:shape.guidelines.open")}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={24} color={colors.text} />
      </Pressable>
      {open ? (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <GuidelinesText form={form} />
        </View>
      ) : null}
    </View>
  );
}
