import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { ItemProvided } from "@/src/types/entities/item";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text } from "react-native";

interface MatchChipsProps {
  matches: ItemProvided[];
  names: string[];
  /** -1 = "+ New", otherwise the index into matches. */
  selected: number;
  onSelect: (index: number) => void;
}

/** "+ New" or one of the closest existing items, each with its name and how many you have. */
function MatchChips({ matches, names, selected, onSelect }: MatchChipsProps) {
  const { t } = useTranslation();

  const chip = (key: string, index: number, label: string, sub: string | null, a11y: string) => {
    const active = selected === index;
    return (
      <Pressable
        key={key}
        onPress={() => onSelect(index)}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={a11y}
        style={{
          minHeight: 48,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          justifyContent: "center",
          borderWidth: active ? borders.focus : borders.width,
          borderColor: active ? colors.secondary : colors.border,
          backgroundColor: active ? colors.surfaceAlt : colors.surface,
        }}
      >
        <Text style={[typography.label, { color: colors.text }]} numberOfLines={1}>
          {active ? <MaterialIcons name="check" size={14} color={colors.text} /> : null}
          {active ? " " : ""}
          {label}
        </Text>
        {sub ? <Text style={[typography.caption, { color: colors.textMuted }]}>{sub}</Text> : null}
      </Pressable>
    );
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} accessibilityRole="radiogroup">
      {chip("new", -1, t("items:review.newChip"), null, t("items:review.addAsNew"))}
      {matches.map((m, i) =>
        chip(m.id, i, names[i] || t("items:review.match", { rank: i + 1 }), t("items:review.youHave", { count: m.quantity }), `${names[i]}, ${t("items:review.youHave", { count: m.quantity })}`),
      )}
    </ScrollView>
  );
}

export default MatchChips;
