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
import CountryPicker from "react-native-country-picker-modal";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import CityAutocomplete from "../ui/city_autocomplete";
import { useCollectionTypeDropdownItems } from "../ui/collection_type_items";
import { Chip, ChipRow, Label } from "../ui/retro";

/** Quick picks for the seller-nationality filter; any other country comes from the picker. */
const COMMON_COUNTRIES: { code: string; label: string }[] = [
  { code: "HU", label: "Hungarian" },
  { code: "GB", label: "British" },
  { code: "US", label: "American" },
  { code: "DE", label: "German" },
  { code: "AT", label: "Austrian" },
  { code: "FR", label: "French" },
];

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
      overlayTitle="Filter listings"
      footerContent={
        <View style={{ flexDirection: "row", gap: 10, width: "90%" }}>
          <View style={{ flex: 1 }}>
            <CustomButton
              title="Reset"
              onPress={() => {
                setDraft({ ...defaultListingFilters, sort: value.sort });
                setMinText("");
                setMaxText("");
              }}
            />
          </View>
          <View style={{ flex: 2 }}>
            <CustomButton title="Show results" onPress={apply} />
          </View>
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Label>Listing type</Label>
        <ChipRow>
          {(Object.keys(listingKindLabels) as ListingKind[]).map((k) => (
            <Chip key={k} label={listingKindLabels[k]} selected={draft.kind === k} onPress={() => toggle("kind", k)} />
          ))}
        </ChipRow>

        <Label>Item type</Label>
        <CustomDropdown<number>
          value={draft.collectionTypeId ?? null}
          open={typeOpen}
          setOpen={setTypeOpen}
          setValue={(v) => setDraft((d) => ({ ...d, collectionTypeId: v ?? undefined }))}
          items={typeItems}
          placeholder="Any item type"
          modalTitle="Item type"
        />

        <Label>Location</Label>
        <CityAutocomplete value={draft.city ?? null} onChange={(city) => setDraft((d) => ({ ...d, city: city ?? undefined }))} />
        {draft.city ? (
          <ChipRow>
            {radiusOptions.map((r) => (
              <Chip key={r} label={`${r} km`} selected={draft.radiusKm === r} onPress={() => toggle("radiusKm", r)} />
            ))}
            <Chip label="Any distance" selected={!draft.radiusKm} onPress={() => setDraft((d) => ({ ...d, radiusKm: undefined }))} />
          </ChipRow>
        ) : null}

        <Label>Price (€)</Label>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <CustomTextInput placeholder="Min" keyboardType="decimal-pad" value={minText} onChangeText={setMinText} />
          </View>
          <View style={{ flex: 1 }}>
            <CustomTextInput placeholder="Max" keyboardType="decimal-pad" value={maxText} onChangeText={setMaxText} />
          </View>
        </View>

        <Label>Condition</Label>
        <ChipRow>
          {(Object.keys(conditionLabels) as ListingCondition[]).map((k) => (
            <Chip key={k} label={conditionLabels[k]} selected={draft.condition === k} onPress={() => toggle("condition", k)} />
          ))}
        </ChipRow>

        <Label>Delivery</Label>
        <ChipRow>
          {(Object.keys(deliveryLabels) as DeliveryMethod[]).map((k) => (
            <Chip key={k} label={deliveryLabels[k]} selected={draft.delivery === k} onPress={() => toggle("delivery", k)} />
          ))}
        </ChipRow>

        <Label>Seller nationality</Label>
        <ChipRow>
          {COMMON_COUNTRIES.map((c) => (
            <Chip
              key={c.code}
              label={`${countryFlag(c.code)} ${c.label}`}
              selected={!!draft.sellerCountries?.includes(c.code)}
              onPress={() => toggleCountry(c.code)}
            />
          ))}
          {extraCountries.map((code) => (
            <Chip key={code} label={`${countryFlag(code)} ${code} ✕`} selected onPress={() => toggleCountry(code)} />
          ))}
          <Chip label="+ Other country" selected={false} onPress={() => setCountryPickerOpen(true)} />
        </ChipRow>
      </ScrollView>
      <CountryPicker
        countryCode={"HU" as any}
        visible={countryPickerOpen}
        onClose={() => setCountryPickerOpen(false)}
        onSelect={(country) => {
          const code = country.cca2.toString();
          setDraft((d) => (d.sellerCountries?.includes(code) ? d : { ...d, sellerCountries: [...(d.sellerCountries ?? []), code] }));
          setCountryPickerOpen(false);
        }}
        renderFlagButton={() => null}
        withCloseButton
        withFilter
        withFlag
      />
    </CustomOverlay>
  );
}

export default ListingFilterOverlay;
