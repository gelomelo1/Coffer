import i18n from "@/src/i18n";
import { SectionHeader } from "@/src/components/custom_ui/card";
import { Checkbox } from "@/src/components/custom_ui/checkbox";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { conditionLabels, listingKindLabels, MAX_LISTING_IMAGES, MAX_LISTING_LINES } from "@/src/const/market";
import { useMarketMutation } from "@/src/hooks/market_api";
import { borders, colors, hitSlopFor, sizes, spacing, typography } from "@/src/theme/theme";
import { City, ListingCondition, ListingDetail, ListingImage, ListingInput, ListingKind } from "@/src/types/entities/market";
import { listingImageResize } from "@/src/const/image_resize_config";
import { pickImage } from "@/src/utils/data_access_utils";
import { resizeForUpload } from "@/src/utils/resize_photo";
import { formatAmountInput } from "@/src/utils/format";
import { LocalImage, marketApi, parsePriceToCents } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import showToast from "../../custom_ui/toast";
import CityAutocomplete from "../ui/city_autocomplete";
import { useCollectionTypeDropdownItems } from "../ui/collection_type_items";
import { Chip, ChipRow, ErrorText, ListingImageView, WarningBanner } from "../ui/retro";

interface LineDraft {
  name: string;
  qty: string;
}

type Errors = Partial<Record<"title" | "type" | "city" | "price" | "exchange" | "condition" | "delivery" | "lines" | "images" | "private", string>>;

const THUMB = 88;

/**
 * Create or edit a listing. The kind and item type are fixed after creation (backend rule).
 * Client validation mirrors the backend so the user sees problems before uploading.
 */
function ListingFormOverlay({
  isVisible,
  onClose,
  initialKind = "sell",
  editing,
  onSaved,
}: {
  isVisible: boolean;
  onClose: () => void;
  initialKind?: ListingKind;
  editing?: ListingDetail | null;
  onSaved?: (listing: ListingDetail) => void;
}) {
  const { t } = useTranslation();
  const typeItems = useCollectionTypeDropdownItems();
  const [kind, setKind] = useState<ListingKind>(initialKind);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [typeOpen, setTypeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [city, setCity] = useState<City | null>(null);
  const [priceText, setPriceText] = useState("");
  const [exchangeFor, setExchangeFor] = useState("");
  const [condition, setCondition] = useState<ListingCondition | null>(null);
  const [pickup, setPickup] = useState(true);
  const [shipping, setShipping] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([{ name: "", qty: "1" }]);
  const [description, setDescription] = useState("");
  const [privateSeller, setPrivateSeller] = useState(false);
  const [keptImages, setKeptImages] = useState<ListingImage[]>([]);
  const [newImages, setNewImages] = useState<LocalImage[]>([]);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (!isVisible) return;
    setErrors({});
    if (editing) {
      setKind(editing.kind);
      setTypeId(editing.collectionTypeId);
      setTitle(editing.title);
      setCity(editing.city);
      setPriceText(editing.priceCents ? formatAmountInput(editing.priceCents, i18n.language) : "");
      setExchangeFor(editing.exchangeFor ?? "");
      setCondition(editing.condition ?? null);
      setPickup(editing.allowsLocalPickup);
      setShipping(editing.allowsShipping);
      setLines(editing.lines.map((l) => ({ name: l.name, qty: String(l.quantity) })));
      setDescription(editing.description ?? "");
      setPrivateSeller(editing.privateSellerDeclared);
      setKeptImages(editing.images);
      setNewImages([]);
    } else {
      setKind(initialKind);
      setTypeId(null);
      setTitle("");
      setCity(null);
      setPriceText("");
      setExchangeFor("");
      setCondition(null);
      setPickup(true);
      setShipping(false);
      setLines([{ name: "", qty: "1" }]);
      setDescription("");
      setPrivateSeller(false);
      setKeptImages([]);
      setNewImages([]);
    }
  }, [isVisible, editing, initialKind]);

  const save = useMarketMutation(
    ({ input, images }: { input: ListingInput; images: LocalImage[] }) =>
      editing ? marketApi.updateListing(editing.id, input, images) : marketApi.createListing(input, images),
    editing ? t("market:form.updated") : t("market:form.published"),
  );

  const imageCount = keptImages.length + newImages.length;
  const imagesRequired = kind !== "wanted";

  const addImages = async (source: "camera" | "gallery") => {
    const remaining = MAX_LISTING_IMAGES - imageCount;
    if (remaining <= 0) return;
    const result = await pickImage(source, {
      allowsMultipleSelection: source === "gallery",
      selectionLimit: remaining,
    });
    if (result.status === "success") {
      // Resized on the phone (1600 px wide) for a fast upload; the server only resizes what arrives bigger.
      const resized = await Promise.all(result.assets.map((a) => resizeForUpload(a, listingImageResize)));
      setNewImages((prev) =>
        [...prev, ...resized.map((a) => ({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType }))].slice(0, MAX_LISTING_IMAGES - keptImages.length),
      );
    } else if (result.status === "permission_denied") {
      showToast("error", t("market:photo.permissionTitle"), t("market:photo.permissionText"));
    }
  };

  const validate = (): ListingInput | null => {
    const e: Errors = {};
    const cleanTitle = title.trim();
    if (cleanTitle.length < 1 || cleanTitle.length > 80) e.title = t("market:form.error.title");
    if (!typeId) e.type = t("market:form.error.type");
    if (!city) e.city = t("market:form.error.city");
    const priceCents = parsePriceToCents(priceText);
    if (kind === "sell" && !priceCents) e.price = t("market:form.error.price");
    if (kind === "wanted" && priceText.trim() && !priceCents) e.price = t("market:form.error.budget");
    if (kind === "exchange" && !exchangeFor.trim()) e.exchange = t("market:form.error.exchange");
    if (kind !== "wanted" && !condition) e.condition = t("market:form.error.condition");
    if (!pickup && !shipping) e.delivery = t("market:form.error.delivery");
    const cleanLines = lines.map((l) => ({ name: l.name.trim(), quantity: Number(l.qty) })).filter((l) => l.name.length > 0);
    if (cleanLines.length === 0) e.lines = t("market:form.error.linesEmpty");
    else if (cleanLines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 9999)) e.lines = t("market:form.error.linesQty");
    else if (cleanLines.some((l) => l.name.length > 80)) e.lines = t("market:form.error.linesName");
    if (imagesRequired && imageCount < 1) e.images = t("market:form.error.images");
    if (kind !== "wanted" && !privateSeller) e.private = t("market:form.error.private");

    setErrors(e);
    if (Object.keys(e).length > 0) return null;
    return {
      kind,
      collectionTypeId: typeId!,
      title: cleanTitle,
      description: description.trim() || null,
      priceCents: kind === "exchange" ? null : priceCents,
      exchangeFor: kind === "exchange" ? exchangeFor.trim() : null,
      condition: condition,
      cityId: city!.id,
      allowsLocalPickup: pickup,
      allowsShipping: shipping,
      lines: cleanLines,
      keepImageIds: keptImages.map((i) => i.id),
      privateSellerDeclared: kind !== "wanted" && privateSeller,
    };
  };

  const submit = () => {
    const input = validate();
    if (!input) {
      showToast("error", t("market:form.checkFields"));
      return;
    }
    save.mutate(
      { input, images: newImages },
      {
        onSuccess: (saved) => {
          onSaved?.(saved);
          onClose();
        },
      },
    );
  };

  const setLine = (i: number, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={() => !save.isPending && onClose()}
      overlayTitle={editing ? t("market:form.editTitle") : kind === "wanted" ? t("market:form.wantedTitle") : t("market:form.newTitle")}
      footerContent={
        <CustomButton title={editing ? t("market:form.save") : t("market:form.publish")} onPress={submit} loading={save.isPending} disabled={save.isPending} />
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.xs, paddingBottom: spacing.xxl * 2 }} keyboardShouldPersistTaps="handled">
        {!editing ? (
          <>
            <SectionHeader title={t("market:form.whatToDo")} />
            <ChipRow>
              {(Object.keys(listingKindLabels) as ListingKind[]).map((k) => (
                <Chip key={k} label={listingKindLabels[k]} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </ChipRow>
          </>
        ) : null}

        <SectionHeader title={t("market:form.itemType")} />
        <CustomDropdown<number>
          value={typeId}
          open={typeOpen}
          setOpen={setTypeOpen}
          setValue={setTypeId}
          items={typeItems}
          placeholder={t("market:form.chooseItemType")}
          modalTitle={t("market:form.itemType")}
          disabled={!!editing}
        />
        {editing ? <Text style={[typography.caption, { color: colors.textMuted }]}>{t("market:form.fixedAfterCreate")}</Text> : null}
        <ErrorText>{errors.type}</ErrorText>

        <CustomTextInput
          label={t("market:form.title")}
          required
          placeholder={kind === "wanted" ? t("market:form.titlePlaceholderWanted") : t("market:form.titlePlaceholder")}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          errorMessage={errors.title}
        />

        <CityAutocomplete value={city} onChange={setCity} errorMessage={errors.city} />
        {city ? <ErrorText>{errors.city}</ErrorText> : null}

        {kind === "exchange" ? (
          <CustomTextInput
            label={t("market:form.exchangeFor")}
            required
            placeholder={t("market:form.exchangePlaceholder")}
            value={exchangeFor}
            onChangeText={setExchangeFor}
            maxLength={300}
            errorMessage={errors.exchange}
          />
        ) : (
          <CustomTextInput
            label={kind === "sell" ? t("market:form.price") : t("market:form.budget")}
            required={kind === "sell"}
            placeholder="0" // i18n-ignore
            keyboardType="decimal-pad"
            value={priceText}
            onChangeText={setPriceText}
            errorMessage={errors.price}
            rightIcon={<Text style={[typography.label, { color: colors.text }]}>EUR</Text>} // i18n-ignore
          />
        )}

        <SectionHeader title={kind === "wanted" ? t("market:form.conditionOptional") : t("market:form.condition")} />
        <ChipRow>
          {(Object.keys(conditionLabels) as ListingCondition[]).map((k) => (
            <Chip key={k} label={conditionLabels[k]} selected={condition === k} onPress={() => setCondition(condition === k ? null : k)} />
          ))}
        </ChipRow>
        <ErrorText>{errors.condition}</ErrorText>

        <SectionHeader title={t("market:form.handover")} />
        <ChipRow>
          <Chip
            label={t("market:delivery.local_pickup")}
            selected={pickup}
            icon={<MaterialIcons name={pickup ? "check-box" : "check-box-outline-blank"} size={18} color={colors.text} />}
            onPress={() => setPickup(!pickup)}
          />
          <Chip
            label={t("market:delivery.shipping")}
            selected={shipping}
            icon={<MaterialIcons name={shipping ? "check-box" : "check-box-outline-blank"} size={18} color={colors.text} />}
            onPress={() => setShipping(!shipping)}
          />
        </ChipRow>
        <ErrorText>{errors.delivery}</ErrorText>
        {shipping ? <WarningBanner /> : null}

        <SectionHeader title={kind === "wanted" ? t("market:form.lookingFor") : t("market:form.included")} />
        {lines.map((line, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
            <View style={{ flex: 3 }}>
              <CustomTextInput
                placeholder={t("market:form.itemPlaceholder")}
                accessibilityLabel={t("market:form.itemA11y", { number: i + 1 })}
                value={line.name}
                maxLength={80}
                onChangeText={(v) => setLine(i, { name: v })}
              />
            </View>
            <View style={{ flex: 1, minWidth: 64 }}>
              <CustomTextInput
                placeholder={t("market:form.qty")}
                accessibilityLabel={t("market:form.qtyA11y", { number: i + 1 })}
                keyboardType="number-pad"
                value={line.qty}
                maxLength={4}
                onChangeText={(v) => setLine(i, { qty: v.replace(/[^0-9]/g, "") })}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("market:form.removeLine", { number: i + 1 })}
              accessibilityState={{ disabled: lines.length === 1 }}
              disabled={lines.length === 1}
              onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))}
              style={({ pressed }) => ({
                width: sizes.touch,
                height: sizes.control,
                alignItems: "center",
                justifyContent: "center",
                opacity: lines.length === 1 ? 0.3 : pressed ? 0.6 : 1,
              })}
            >
              <MaterialIcons name="remove-circle-outline" size={sizes.iconMd} color={colors.danger} />
            </Pressable>
          </View>
        ))}
        {lines.length < MAX_LISTING_LINES ? (
          <ChipRow>
            <Chip
              label={t("market:form.addLine")}
              icon={<MaterialIcons name="add" size={18} color={colors.text} />}
              onPress={() => setLines((ls) => [...ls, { name: "", qty: "1" }])}
            />
          </ChipRow>
        ) : null}
        <ErrorText>{errors.lines}</ErrorText>

        <SectionHeader
          title={
            imagesRequired
              ? t("market:form.photos", { count: imageCount, max: MAX_LISTING_IMAGES })
              : t("market:form.photosOptional", { count: imageCount, max: MAX_LISTING_IMAGES })
          }
        />
        {imageCount > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.xs, paddingRight: spacing.xs }}>
            {keptImages.map((img, i) => (
              <View key={img.id}>
                <ListingImageView fileName={img.fileName} style={{ width: THUMB, height: THUMB, borderWidth: borders.width, borderColor: colors.border }} />
                <RemoveBadge label={t("market:form.removePhoto", { number: i + 1 })} onPress={() => setKeptImages((list) => list.filter((x) => x.id !== img.id))} />
              </View>
            ))}
            {newImages.map((img, i) => (
              <View key={img.uri + i}>
                <Image source={{ uri: img.uri }} style={{ width: THUMB, height: THUMB, borderWidth: borders.width, borderColor: colors.border }} />
                <RemoveBadge
                  label={t("market:form.removePhoto", { number: keptImages.length + i + 1 })}
                  onPress={() => setNewImages((list) => list.filter((_, j) => j !== i))}
                />
              </View>
            ))}
          </ScrollView>
        ) : null}
        {imageCount < MAX_LISTING_IMAGES ? (
          <ChipRow>
            <Chip label={t("market:photo.camera")} icon={<MaterialIcons name="photo-camera" size={18} color={colors.text} />} onPress={() => addImages("camera")} />
            <Chip label={t("market:photo.gallery")} icon={<MaterialIcons name="photo-library" size={18} color={colors.text} />} onPress={() => addImages("gallery")} />
          </ChipRow>
        ) : null}
        <ErrorText>{errors.images}</ErrorText>

        {kind !== "wanted" ? (
          <>
            <Checkbox
              checked={privateSeller}
              error={!!errors.private}
              onPress={() => setPrivateSeller(!privateSeller)}
              label={t("market:form.privateSeller")}
              style={{ marginTop: spacing.xs }}
            />
            <ErrorText>{errors.private}</ErrorText>
          </>
        ) : null}

        <CustomTextInput
          label={t("market:form.description")}
          placeholder={t("market:form.descriptionPlaceholder")}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          containerStyle={{ maxHeight: 220 }}
        />
      </ScrollView>
    </CustomOverlay>
  );
}

/** 48dp remove target in the photo's corner. */
function RemoveBadge({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlopFor(28)}
      style={({ pressed }) => ({
        position: "absolute",
        top: -spacing.xs,
        right: -spacing.xs,
        width: 28,
        height: 28,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
        borderWidth: borders.width,
        borderColor: colors.border,
      })}
    >
      <MaterialIcons name="close" size={18} color={colors.danger} />
    </Pressable>
  );
}

export default ListingFormOverlay;
