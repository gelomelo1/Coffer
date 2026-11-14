import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { MARKET_TERMS, MARKET_TERMS_VERSION } from "@/src/const/market";
import { useMarketMutation } from "@/src/hooks/market_api";
import { useMarketStore } from "@/src/hooks/market_store";
import { customTheme } from "@/src/theme/theme";
import { marketApi } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SectionCard } from "../ui/retro";

const c = customTheme.colors;

function Check({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <MaterialIcons name={checked ? "check-box" : "check-box-outline-blank"} size={26} color={c.primary} />
      <CustomText style={{ flex: 1 }}>{label}</CustomText>
    </TouchableOpacity>
  );
}

/** Shown instead of the Market until the user accepts the current marketplace terms. */
function TermsGate() {
  const [adult, setAdult] = useState(false);
  const [privatePerson, setPrivatePerson] = useState(false);
  const accept = useMarketMutation(() => marketApi.acceptTerms(MARKET_TERMS_VERSION), "Welcome to the market!");

  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 4, paddingBottom: 140 }}>
      <CustomText style={{ fontFamily: "VendSansBold", fontSize: 22, marginBottom: 6 }}>Before you start trading</CustomText>
      {MARKET_TERMS.map((t) => (
        <SectionCard key={t.title} title={t.title}>
          <CustomText style={{ fontSize: 14 }}>{t.text}</CustomText>
        </SectionCard>
      ))}
      <Check checked={adult} onPress={() => setAdult(!adult)} label="I am 18 or older." />
      <Check checked={privatePerson} onPress={() => setPrivatePerson(!privatePerson)}
        label="I trade as a private person, not as a business." />
      <View style={{ marginTop: 10 }}>
        <CustomButton
          title="I accept the marketplace terms"
          disabled={!adult || !privatePerson || accept.isPending}
          loading={accept.isPending}
          onPress={() => accept.mutate(undefined, { onSuccess: () => useMarketStore.getState().setTermsNeeded(false) })}
        />
      </View>
      <CustomText style={{ fontSize: 12, marginTop: 6 }}>Terms version {MARKET_TERMS_VERSION}</CustomText>
    </ScrollView>
  );
}

export default TermsGate;
