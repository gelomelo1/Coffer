import { colors, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { selectFieldStyle, selectTextStyle } from "./select_shared";

interface MonthRangeFieldProps {
  label: string;
  after: Date | null;
  before: Date | null;
  onPick: (which: "after" | "before") => void;
}

/** "After / Before" date pair used by list filters; each half opens the month picker. Wraps on narrow screens. */
export function MonthRangeField({ label, after, before, onPick }: MonthRangeFieldProps) {
  const { t, i18n } = useTranslation();
  const field = (which: "after" | "before", value: Date | null) => {
    const name = which === "after" ? t("collections:filter.after") : t("collections:filter.before");
    const shown = value ? value.toLocaleDateString(i18n.language) : t("collections:filter.anyDate");
    return (
      <Pressable
        onPress={() => onPick(which)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${name}`}
        accessibilityValue={{ text: shown }}
        style={{ flex: 1, minWidth: 130, gap: spacing.xxs }}
      >
        <Text style={[typography.caption, { color: colors.text }]}>{name}</Text>
        <View style={[selectFieldStyle, { flexDirection: "row", alignItems: "center", gap: spacing.xs }]}>
          <MaterialIcons name="event" size={20} color={colors.text} />
          <Text style={[selectTextStyle, { flex: 1 }, !value && { color: colors.textMuted }]} numberOfLines={1}>
            {shown}
          </Text>
        </View>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {field("after", after)}
        {field("before", before)}
      </View>
    </View>
  );
}

export default MonthRangeField;
