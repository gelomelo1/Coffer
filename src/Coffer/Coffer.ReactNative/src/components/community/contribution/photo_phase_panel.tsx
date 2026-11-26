import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { ContributionForm, PhaseView, PhotoTotals } from "@/src/types/entities/contribution";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { navigate } from "expo-router/build/global-state/routing";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { ExampleGallery, useHasExamples } from "./example_gallery";
import { GuidelinesText } from "./guidelines";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

/** A photo round: what it's for, and one card per form with the user's count and its actions. */
export function PhotoPhasePanel({ phase }: { phase: PhaseView }) {
  const { t } = useTranslation();
  const mine = phase.mine ?? { detectionPhotos: 0, classificationForms: 0 };
  const dailyLeft = phase.limits?.dailyLeft ?? 0;
  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[typography.headline, { color: colors.text }]} accessibilityRole="header">
        {t("community:shape.photo.title", { subject: phase.subject?.name ?? "" })}
      </Text>
      <Text style={[typography.body, { color: colors.text }]}>{t("community:shape.photo.intro")}</Text>
      {phase.totals ? <TotalsCard totals={phase.totals} /> : null}
      {dailyLeft < 40 ? (
        <Text style={[typography.label, { color: dailyLeft === 0 ? colors.danger : colors.text }]}>
          {t("community:shape.limits.left", { count: dailyLeft })}
        </Text>
      ) : null}
      <FormCard
        form="detection"
        icon="image-multiple-outline"
        count={t("community:shape.detection.mine", { count: mine.detectionPhotos })}
        action={t("community:shape.detection.open")}
        route={ROUTES.COMMUNITY.SHAPE_DETECTION}
      />
      <FormCard
        form="classification"
        icon="shape-outline"
        count={t("community:shape.classification.mine", { count: mine.classificationForms })}
        action={t("community:shape.classification.open")}
        route={ROUTES.COMMUNITY.SHAPE_CLASSIFICATION}
      />
    </View>
  );
}

/** What everyone sent so far: people, detection photos, classification forms (and the photos in them). */
function TotalsCard({ totals }: { totals: PhotoTotals }) {
  const { t } = useTranslation();
  const tiles: { icon: IconName; value: number; label: string }[] = [
    { icon: "account-group-outline", value: totals.contributors, label: t("community:shape.totals.contributors", { count: totals.contributors }) },
    { icon: "image-multiple-outline", value: totals.detectionPhotos, label: t("community:shape.totals.detection", { count: totals.detectionPhotos }) },
    { icon: "shape-outline", value: totals.forms, label: t("community:shape.totals.forms", { count: totals.forms }) },
  ];
  return (
    <View
      accessible
      accessibilityLabel={`${t("community:shape.totals.title")}: ${t("community:shape.totals.a11y", {
        contributors: totals.contributors, detection: totals.detectionPhotos, forms: totals.forms, formPhotos: totals.formPhotos,
      })}`}
      style={{ gap: spacing.sm, padding: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <Text style={[typography.title, { color: colors.text }]}>{t("community:shape.totals.title")}</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {tiles.map((tile) => (
          <View key={tile.icon} style={{ flex: 1, gap: spacing.xxs, padding: spacing.sm, borderWidth: borders.hairline, borderColor: colors.border, backgroundColor: colors.bg }}>
            <MaterialCommunityIcons name={tile.icon} size={20} color={colors.secondary} />
            <Text style={[typography.headline, { color: colors.text, fontVariant: ["tabular-nums"] }]}>{tile.value}</Text>
            <Text style={[typography.meta, { color: colors.textMuted }]}>{tile.label}</Text>
          </View>
        ))}
      </View>
      <Text style={[typography.meta, { color: colors.textMuted, fontVariant: ["tabular-nums"] }]}>
        {t("community:shape.totals.formPhotos", { count: totals.formPhotos })}
      </Text>
    </View>
  );
}

function FormCard({ form, icon, count, action, route }: { form: ContributionForm; icon: IconName; count: string; action: string; route: any }) {
  const { t } = useTranslation();
  const [guidelines, setGuidelines] = useState(false);
  const [examples, setExamples] = useState(false);
  const hasExamples = useHasExamples(form);
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary, borderWidth: borders.width, borderColor: colors.border }}>
          <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.title, { color: colors.text }]}>{t(`community:shape.${form}.title`)}</Text>
          <Text style={[typography.label, { color: colors.text, fontVariant: ["tabular-nums"] }]}>{count}</Text>
        </View>
      </View>
      <Text style={[typography.meta, { color: colors.textMuted }]}>{t(`community:shape.${form}.description`)}</Text>
      <CustomButton title={action} onPress={() => navigate({ pathname: route, params: pageParams.communityPage(`community:shape.${form}.title`) })} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <CustomButton title={t("community:shape.guidelines.open")} variant="outline" size="sm" onPress={() => setGuidelines(true)} containerStyle={{ flex: 1 }} />
        {hasExamples ? (
          <CustomButton title={t("community:shape.examples.open")} variant="outline" size="sm" onPress={() => setExamples(true)} containerStyle={{ flex: 1 }} />
        ) : null}
      </View>
      <CustomOverlay isVisible={guidelines} onClose={() => setGuidelines(false)} overlayTitle={t("community:shape.guidelines.open")}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
          <GuidelinesText form={form} />
        </ScrollView>
      </CustomOverlay>
      <ExampleGallery form={form} isVisible={examples} onClose={() => setExamples(false)} />
    </View>
  );
}
