import { useTranslation } from "react-i18next";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { conditionLabels, deliveryLabels, listingKindLabels, radiusOptions } from "@/src/const/market";
import { defaultListingFilters } from "@/src/hooks/market_store";
import {
  DeliveryMethod,
  ListingCondition,
  ListingFilters,
  ListingKind,
} from "@/src/types/entities/market";
import { countryFlag, parsePriceToCents } from "@/src/utils/market_api";
import { CountryPickerModal } from "@/src/components/custom_ui/country_field";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import CityAutocomplete from "../ui/city_autocomplete";
import { useCollectionTypeDropdownItems } from "../ui/collection_type_items";
import { SectionHeader } from "@/src/components/custom_ui/card";
import { spacing } from "@/src/theme/theme";
import { Chip, ChipRow } from "../ui/retro";

/** Quick picks for the seller-nationality filter; any other country comes from the picker. */
const COMMON_COUNTRIES: { code: string }[] = [{ code: "HU" }, { code: "GB" }, { code: "US" }, { code: "DE" }, { code: "AT" }, { code: "FR" }];

export function activeFilterCount(f: ListingFilters) {
  return [f.kind, f.collectionTypeId, f.city, f.minPriceCents, f.maxPriceCents, f.condition, f.delivery].filter(
    (v) => v !== undefined && v !== null,
  ).length + (f.sellerCountries?.length ? 1 : 0);
}

/** Full-screen filter editor; changes apply only on "Show results". */
function ListingFilterOverlay({
  isVisible,
  onClose,
  value,
  onApply,
}: {
  isVisible: boolean;
  onClose: () => void;
  value: ListingFilters;
  onApply: (filters: ListingFilters) => void;
}) {
  const { t } = useTranslation();
  const typeItems = useCollectionTypeDropdownItems();
  const [draft, setDraft] = useState<ListingFilters>(value);
  const [typeOpen, setTypeOpen] = useState(false);
  const [minText, setMinText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const toggleCountry = (code: string) =>
    setDraft((d) => {
      const list = d.sellerCountries ?? [];
      const next = list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
      return { ...d, sellerCountries: next.length ? next : undefined };
    });
  const extraCountries = (draft.sellerCountries ?? []).filter((c) => !COMMON_COUNTRIES.some((x) => x.code === c));

  useEffect(() => {
    if (!isVisible) return;
    setDraft(value);
    setMinText(value.minPriceCents != null ? String(value.minPriceCents / 100) : "");
    setMaxText(value.maxPriceCents != null ? String(value.maxPriceCents / 100) : "");
  }, [isVisible, value]);

  const toggle = <K extends keyof ListingFilters>(key: K, v: ListingFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: d[key] === v ? undefined : v }));

  const apply = () => {
    const next: ListingFilters = {
      ...draft,
      minPriceCents: parsePriceToCents(minText) ?? undefined,
      maxPriceCents: parsePriceToCents(maxText) ?? undefined,
      radiusKm: draft.city ? draft.radiusKm : undefined,
      sort: !draft.city && draft.sort === "nearest" ? "newest" : draft.sort,
    };
    onApply(next);
    onClose();
  };

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle={t("market:filter.title")}
      footerContent={
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <CustomButton
              title={t("common:actions.reset")}
              variant="outline"
              onPress={() => {
                setDraft({ ...defaultListingFilters, sort: value.sort });
                setMinText("");
                setMaxText("");
              }}
            />
          </View>
          <View style={{ flex: 2 }}>
            <CustomButton title={t("market:filter.showResults")} onPress={apply} />
          </View>
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        <SectionHeader title={t("market:filter.listingType")} />
        <ChipRow>
          {(Object.keys(listingKindLabels) as ListingKind[]).map((k) => (
            <Chip key={k} label={listingKindLabels[k]} selected={draft.kind === k} onPress={() => toggle("kind", k)} />
          ))}
        </ChipRow>

        <SectionHeader title={t("market:filter.itemType")} />
        <CustomDropdown<number>
          value={draft.collectionTypeId ?? null}
          open={typeOpen}
          setOpen={setTypeOpen}
          setValue={(v) => setDraft((d) => ({ ...d, collectionTypeId: v ?? undefined }))}
          items={typeItems}
          placeholder={t("market:filter.anyItemType")}
          modalTitle={t("market:filter.itemType")}
        />

        <SectionHeader title={t("market:filter.location")} />
        <CityAutocomplete value={draft.city ?? null} onChange={(city) => setDraft((d) => ({ ...d, city: city ?? undefined }))} />
        {draft.city ? (
          <ChipRow>
            {radiusOptions.map((r) => (
              <Chip key={r} label={t("market:format.km", { km: r })} selected={draft.radiusKm === r} onPress={() => toggle("radiusKm", r)} />
            ))}
            <Chip label={t("market:filter.anyDistance")} selected={!draft.radiusKm} onPress={() => setDraft((d) => ({ ...d, radiusKm: undefined }))} />
          </ChipRow>
        ) : null}

        <SectionHeader title={t("market:filter.price")} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <CustomTextInput placeholder={t("market:filter.min")} accessibilityLabel={t("market:filter.minA11y")} keyboardType="decimal-pad" value={minText} onChangeText={setMinText} />
          </View>
          <View style={{ flex: 1 }}>
            <CustomTextInput placeholder={t("market:filter.max")} accessibilityLabel={t("market:filter.maxA11y")} keyboardType="decimal-pad" value={maxText} onChangeText={setMaxText} />
          </View>
        </View>

        <SectionHeader title={t("market:filter.condition")} />
        <ChipRow>
          {(Object.keys(conditionLabels) as ListingCondition[]).map((k) => (
            <Chip key={k} label={conditionLabels[k]} selected={draft.condition === k} onPress={() => toggle("condition", k)} />
          ))}
        </ChipRow>

        <SectionHeader title={t("market:filter.delivery")} />
        <ChipRow>
          {(Object.keys(deliveryLabels) as DeliveryMethod[]).map((k) => (
            <Chip key={k} label={deliveryLabels[k]} selected={draft.delivery === k} onPress={() => toggle("delivery", k)} />
          ))}
        </ChipRow>

        <SectionHeader title={t("market:filter.nationality")} />
        <ChipRow>
          {COMMON_COUNTRIES.map((c) => (
            <Chip
              key={c.code}
              label={`${countryFlag(c.code)} ${t(`market:nationality.${c.code}`)}`}
              selected={!!draft.sellerCountries?.includes(c.code)}
              onPress={() => toggleCountry(c.code)}
            />
          ))}
          {extraCountries.map((code) => (
            <Chip key={code} label={`${countryFlag(code)} ${code} ✕`} accessibilityLabel={t("market:filter.removeCountry", { code })} selected onPress={() => toggleCountry(code)} />
          ))}
          <Chip label={t("market:filter.otherCountry")} selected={false} onPress={() => setCountryPickerOpen(true)} />
        </ChipRow>
      </ScrollView>
      <CountryPickerModal
        visible={countryPickerOpen}
        onClose={() => setCountryPickerOpen(false)}
        onSelect={(country) => {
          const code = country.cca2.toString();
          setDraft((d) => (d.sellerCountries?.includes(code) ? d : { ...d, sellerCountries: [...(d.sellerCountries ?? []), code] }));
        }}
      />
    </CustomOverlay>
  );
}

export default ListingFilterOverlay;
