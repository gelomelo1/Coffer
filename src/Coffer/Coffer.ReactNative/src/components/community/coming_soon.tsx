import { borders, colors, spacing, typography } from "@/src/theme/theme";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/** A Community page that isn't built yet: what it will be, in a friendly way. */
export function ComingSoon({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const { t } = useTranslation();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg }}>
      <View style={{ alignItems: "center", gap: spacing.md, padding: spacing.lg, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary, borderWidth: borders.width, borderColor: colors.border }}>
          <MaterialCommunityIcons name={icon} size={56} color={colors.primary} />
        </View>
        <Text style={[typography.label, { color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }]}>{t("community:comingSoon")}</Text>
        <Text accessibilityRole="header" style={[typography.display, { color: colors.text, textAlign: "center" }]}>
          {title}
        </Text>
        <Text style={[typography.body, { color: colors.text, textAlign: "center" }]}>{text}</Text>
      </View>
    </ScrollView>
  );
}

export default ComingSoon;
