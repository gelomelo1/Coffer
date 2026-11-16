import { Checkbox } from "@/src/components/custom_ui/checkbox";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { MARKET_TERMS_VERSION, marketTerms } from "@/src/const/market";
import { useMarketMutation } from "@/src/hooks/market_api";
import { useMarketStore } from "@/src/hooks/market_store";
import { colors, spacing, typography } from "@/src/theme/theme";
import { marketApi } from "@/src/utils/market_api";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SectionCard } from "../ui/retro";

/** Shown instead of the Market until the user accepts the current marketplace terms. */
function TermsGate() {
  const { t } = useTranslation();
  const [adult, setAdult] = useState(false);
  const [privatePerson, setPrivatePerson] = useState(false);
  const accept = useMarketMutation(() => marketApi.acceptTerms(MARKET_TERMS_VERSION), t("market:terms.welcome"));

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl * 2 }}>
      <Text accessibilityRole="header" style={[typography.headline, { color: colors.text, marginBottom: spacing.md }]}>
        {t("market:terms.title")}
      </Text>
      {marketTerms().map((term) => (
        <SectionCard key={term.title} title={term.title}>
          <Text style={[typography.meta, { color: colors.text }]}>{term.text}</Text>
        </SectionCard>
      ))}
      <Checkbox checked={adult} onPress={() => setAdult(!adult)} label={t("market:terms.adult")} />
      <Checkbox checked={privatePerson} onPress={() => setPrivatePerson(!privatePerson)} label={t("market:terms.privatePerson")} />
      <View style={{ marginTop: spacing.md }}>
        <CustomButton
          title={t("market:terms.accept")}
          disabled={!adult || !privatePerson || accept.isPending}
          loading={accept.isPending}
          onPress={() => accept.mutate(undefined, { onSuccess: () => useMarketStore.getState().setTermsNeeded(false) })}
        />
      </View>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
        {t("market:terms.version", { version: MARKET_TERMS_VERSION })}
      </Text>
    </ScrollView>
  );
}

export default TermsGate;
