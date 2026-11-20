import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import CustomButton from "../custom_ui/custom_button";

interface ActionBarProps {
  /** Required fields still empty, in form order. Empty = ready. */
  missing: { id: number; name: string }[];
  /** Shown when ready, e.g. "+2 to Heineken" or "new item". */
  readyText: string;
  /** Another problem blocks Add (e.g. an invalid field). */
  blockedText: string | null;
  onJumpTo: (attributeId: number) => void;
  onAdd: () => void;
  onSkip: () => void;
  onDelete: () => void;
  bottomInset: number;
}

/**
 * Always on screen: what is still needed to add this cap, and the three actions. Add is never a silent dead button:
 * while disabled it says why, and each missing field's name jumps to that field.
 */
function ActionBar({ missing, readyText, blockedText, onJumpTo, onAdd, onSkip, onDelete, bottomInset }: ActionBarProps) {
  const { t } = useTranslation();
  const ready = missing.length === 0 && !blockedText;
  const why = missing.length > 0 ? t("items:review.stillNeeded", { fields: missing.map((m) => m.name).join(", ") }) : blockedText;

  return (
    <View
      style={{
        borderTopWidth: borders.width,
        borderTopColor: colors.border,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm + bottomInset,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" }} accessibilityLiveRegion="polite">
        <MaterialIcons name={ready ? "check-circle" : "error-outline"} size={sizes.iconSm ?? 18} color={ready ? colors.success : colors.danger} />
        {ready ? (
          <Text style={[typography.label, { color: colors.text, flexShrink: 1 }]}>{t("items:review.ready", { what: readyText })}</Text>
        ) : missing.length > 0 ? (
          <>
            <Text style={[typography.label, { color: colors.text }]}>{t("items:review.stillNeededLabel")}</Text>
            {missing.map((m, i) => (
              <Pressable key={m.id} onPress={() => onJumpTo(m.id)} accessibilityRole="link" accessibilityHint={t("items:review.jumpHint")} hitSlop={8}>
                <Text style={[typography.label, { color: colors.danger, textDecorationLine: "underline" }]}>
                  {m.name}
                  {i < missing.length - 1 ? "," : ""}
                </Text>
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={[typography.label, { color: colors.danger, flexShrink: 1 }]}>{blockedText}</Text>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <CustomButton
          title={t("items:review.delete")}
          variant="outline"
          size="sm"
          icon={<MaterialIcons name="delete-outline" size={18} color={colors.danger} />}
          titleStyle={{ color: colors.danger }}
          onPress={onDelete}
          accessibilityHint={t("items:review.deleteHint")}
          containerStyle={{ flex: 1.2 }}
        />
        <CustomButton title={t("items:review.skip")} variant="outline" size="sm" onPress={onSkip} accessibilityHint={t("items:review.skipHint")} containerStyle={{ flex: 1 }} />
        <CustomButton
          title={t("items:review.add")}
          size="sm"
          icon={<MaterialIcons name="check" size={18} color={ready ? colors.onPrimary : colors.textMuted} />}
          onPress={onAdd}
          disabled={!ready}
          accessibilityLabel={ready ? t("items:review.add") : `${t("items:review.add")}, ${why}`}
          containerStyle={{ flex: 1.2 }}
        />
      </View>
    </View>
  );
}

export default ActionBar;
