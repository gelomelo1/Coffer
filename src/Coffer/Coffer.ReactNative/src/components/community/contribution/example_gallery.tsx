import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import { useContributionExamples } from "@/src/hooks/contribution";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { ContributionForm } from "@/src/types/entities/contribution";
import { contributionExampleUrl } from "@/src/utils/contribution_api";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";

/** Whether a form has example images (the Examples button is hidden otherwise). */
export function useHasExamples(form: ContributionForm) {
  const { data } = useContributionExamples();
  return (data?.[form]?.length ?? 0) > 0;
}

/**
 * The general example gallery of a form (good and bad examples are marked on the images themselves): a grid, and a
 * full-screen view with previous / next buttons.
 */
export function ExampleGallery({ form, isVisible, onClose }: { form: ContributionForm; isVisible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data } = useContributionExamples();
  const token = useUserStore((s) => s.token);
  const headers = { Authorization: `Bearer ${token}` };
  const files = data?.[form] ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const label = (i: number) => t("community:shape.examples.imageA11y", { index: i + 1, count: files.length });

  return (
    <CustomOverlay isVisible={isVisible} onClose={onClose} overlayTitle={t("community:shape.examples.title")}>
      <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {files.map((file, i) => (
          <Pressable
            key={file}
            onPress={() => setOpen(i)}
            accessibilityRole="imagebutton"
            accessibilityLabel={label(i)}
            style={({ pressed }) => ({ width: "47%", aspectRatio: 1, borderWidth: borders.width, borderColor: colors.border, opacity: pressed ? 0.8 : 1 })}
          >
            <Image source={{ uri: contributionExampleUrl(form, file), headers }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        {open !== null ? (
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", padding: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[typography.label, { color: colors.onPrimary }]}>{t("community:shape.examples.position", { index: open + 1, count: files.length })}</Text>
              <Pressable onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel={t("community:shape.examples.close")}
                style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="close" size={28} color={colors.onPrimary} />
              </Pressable>
            </View>
            <Image source={{ uri: contributionExampleUrl(form, files[open]), headers }} accessibilityLabel={label(open)} style={{ flex: 1 }} resizeMode="contain" />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {[
                { icon: "chevron-left" as const, label: t("community:shape.examples.previous"), to: open - 1 },
                { icon: "chevron-right" as const, label: t("community:shape.examples.next"), to: open + 1 },
              ].map((b) => {
                const disabled = b.to < 0 || b.to >= files.length;
                return (
                  <Pressable key={b.icon} onPress={() => setOpen(b.to)} disabled={disabled} accessibilityRole="button" accessibilityLabel={b.label}
                    accessibilityState={{ disabled }} style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}>
                    <MaterialCommunityIcons name={b.icon} size={36} color={colors.onPrimary} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </Modal>
    </CustomOverlay>
  );
}
