import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import {
  conditionLabels,
  listingKindLabels,
  MAX_LISTING_IMAGES,
  MAX_LISTING_LINES,
} from "@/src/const/market";
import { useMarketMutation } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import {
  City,
  ListingCondition,
  ListingDetail,
  ListingImage,
  ListingInput,
  ListingKind,
} from "@/src/types/entities/market";
import { pickImage } from "@/src/utils/data_access_utils";
import { LocalImage, marketApi, parsePriceToCents } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { Image, ScrollView, TouchableOpacity, View } from "react-native";
import showToast from "../../custom_ui/toast";
import CityAutocomplete from "../ui/city_autocomplete";
import { useCollectionTypeDropdownItems } from "../ui/collection_type_items";
import { Chip, ChipRow, ErrorText, Label, ListingImageView, WarningBanner } from "../ui/retro";

const c = customTheme.colors;

interface LineDraft {
  name: string;
  qty: string;
}

type Errors = Partial<Record<"title" | "type" | "city" | "price" | "exchange" | "condition" | "delivery" | "lines" | "images" | "private", string>>;

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
      setPriceText(editing.priceCents ? String(editing.priceCents / 100) : "");
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
    editing ? "Listing updated" : "Listing published",
  );

  const imageCount = keptImages.length + newImages.length;
  const imagesRequired = kind !== "wanted";

  const addImages = async (source: "camera" | "gallery") => {
    const remaining = MAX_LISTING_IMAGES - imageCount;
    if (remaining <= 0) return;
    const result = await pickImage(source, {
      quality: 0.6,
      allowsMultipleSelection: source === "gallery",
      selectionLimit: remaining,
    });
    if (result.status === "success") {
      setNewImages((prev) =>
        [...prev, ...result.assets.map((a) => ({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType }))].slice(
          0,
          MAX_LISTING_IMAGES - keptImages.length,
        ),
      );
    } else if (result.status === "permission_denied") {
      showToast("error", "Permission needed", "Allow camera / photo access in the system settings.");
    }
  };

  const validate = (): ListingInput | null => {
    const e: Errors = {};
    const t = title.trim();
    if (t.length < 1 || t.length > 80) e.title = "Give a title (max 80 characters).";
    if (!typeId) e.type = "Choose the item type.";
    if (!city) e.city = "Choose the city you sell in.";
    const priceCents = parsePriceToCents(priceText);
    if (kind === "sell" && !priceCents) e.price = "Enter a price in euro.";
    if (kind === "wanted" && priceText.trim() && !priceCents) e.price = "Budget must be a positive amount.";
    if (kind === "exchange" && !exchangeFor.trim()) e.exchange = "Describe what you want in exchange.";
    if (kind !== "wanted" && !condition) e.condition = "Choose the condition.";
    if (!pickup && !shipping) e.delivery = "Choose personal pickup, shipping or both.";
    const cleanLines = lines
      .map((l) => ({ name: l.name.trim(), quantity: Number(l.qty) }))
      .filter((l) => l.name.length > 0);
    if (cleanLines.length === 0) e.lines = "List at least one item that is included.";
    else if (cleanLines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 9999))
      e.lines = "Quantities must be whole numbers from 1 to 9999.";
    else if (cleanLines.some((l) => l.name.length > 80)) e.lines = "Item names can be at most 80 characters.";
    if (imagesRequired && imageCount < 1) e.images = "Add at least one photo.";
    if (kind !== "wanted" && !privateSeller) e.private = "Confirm that you sell as a private person.";

    setErrors(e);
    if (Object.keys(e).length > 0) return null;
    return {
      kind,
      collectionTypeId: typeId!,
      title: t,
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
      showToast("error", "Check the highlighted fields");
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

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={() => !save.isPending && onClose()}
      overlayTitle={editing ? "Edit listing" : kind === "wanted" ? "I'm searching for…" : "New listing"}
      footerContent={
        <View style={{ width: "90%" }}>
          <CustomButton
            title={editing ? "Save changes" : "Publish"}
            onPress={submit}
            loading={save.isPending}
            disabled={save.isPending}
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 12, gap: 6, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {!editing ? (
          <>
            <Label>What do you want to do?</Label>
            <ChipRow>
              {(Object.keys(listingKindLabels) as ListingKind[]).map((k) => (
                <Chip key={k} label={listingKindLabels[k]} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </ChipRow>
          </>
        ) : null}

        <Label>Item type</Label>
        <CustomDropdown<number>
          value={typeId}
          open={typeOpen}
          setOpen={setTypeOpen}
          setValue={setTypeId}
          items={typeItems}
          placeholder="Choose item type"
          modalTitle="Item type"
          disabled={!!editing}
        />
        <ErrorText>{errors.type}</ErrorText>

        <CustomTextInput
          label="Title"
          placeholder={kind === "wanted" ? "e.g. Looking for 1990s forint coins" : "e.g. Hungarian forint coin set"}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          errorMessage={errors.title}
        />

        <CityAutocomplete label="City" value={city} onChange={setCity} errorMessage={errors.city} />
        <ErrorText>{errors.city}</ErrorText>

        {kind === "exchange" ? (
          <CustomTextInput
            label="What do you want in exchange?"
            placeholder="e.g. Austrian schillings, stamps from the 60s"
            value={exchangeFor}
            onChangeText={setExchangeFor}
            maxLength={300}
            errorMessage={errors.exchange}
          />
        ) : (
          <CustomTextInput
            label={kind === "sell" ? "Price (€)" : "Budget (€, optional)"}
            placeholder="0"
            keyboardType="decimal-pad"
            value={priceText}
            onChangeText={setPriceText}
            errorMessage={errors.price}
            rightIcon={<CustomText style={{ fontFamily: "VendSansBold" }}>EUR</CustomText>}
          />
        )}

        <Label>{kind === "wanted" ? "Condition (optional)" : "Condition"}</Label>
        <ChipRow>
          {(Object.keys(conditionLabels) as ListingCondition[]).map((k) => (
            <Chip key={k} label={conditionLabels[k]} selected={condition === k} onPress={() => setCondition(condition === k ? null : k)} />
          ))}
        </ChipRow>
        <ErrorText>{errors.condition}</ErrorText>

        <Label>Handover</Label>
        <ChipRow>
          <Chip label="Personal pickup" selected={pickup} onPress={() => setPickup(!pickup)} />
          <Chip label="Shipping" selected={shipping} onPress={() => setShipping(!shipping)} />
        </ChipRow>
        <ErrorText>{errors.delivery}</ErrorText>
        {shipping ? <WarningBanner /> : null}

        <Label>{kind === "wanted" ? "What are you looking for?" : "What's included?"}</Label>
        {lines.map((line, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <CustomText style={{ fontSize: 22, marginTop: 8 }}>•</CustomText>
            <View style={{ flex: 3 }}>
              <CustomTextInput
                placeholder="Item"
                value={line.name}
                maxLength={80}
                onChangeText={(v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, name: v } : l)))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <CustomTextInput
                placeholder="Qty"
                keyboardType="number-pad"
                value={line.qty}
                maxLength={4}
                onChangeText={(v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, qty: v.replace(/[^0-9]/g, "") } : l)))}
              />
            </View>
            <TouchableOpacity
              accessibilityLabel="Remove item"
              disabled={lines.length === 1}
              onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))}
              style={{ marginTop: 10, opacity: lines.length === 1 ? 0.3 : 1 }}
            >
              <MaterialIcons name="remove-circle-outline" size={26} color="red" />
            </TouchableOpacity>
          </View>
        ))}
        {lines.length < MAX_LISTING_LINES ? (
          <Chip
            label="Add item"
            icon={<MaterialIcons name="add" size={16} color={c.primary} />}
            onPress={() => setLines((ls) => [...ls, { name: "", qty: "1" }])}
            style={{ alignSelf: "flex-start" }}
          />
        ) : null}
        <ErrorText>{errors.lines}</ErrorText>

        <Label>
          Photos ({imageCount}/{MAX_LISTING_IMAGES}){imagesRequired ? "" : " — optional"}
        </Label>
        <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {keptImages.map((img) => (
            <View key={img.id}>
              <ListingImageView fileName={img.fileName} style={{ width: 80, height: 80 }} />
              <RemoveBadge onPress={() => setKeptImages((list) => list.filter((x) => x.id !== img.id))} />
            </View>
          ))}
          {newImages.map((img, i) => (
            <View key={img.uri + i}>
              <Image source={{ uri: img.uri }} style={{ width: 80, height: 80 }} />
              <RemoveBadge onPress={() => setNewImages((list) => list.filter((_, j) => j !== i))} />
            </View>
          ))}
        </ScrollView>
        {imageCount < MAX_LISTING_IMAGES ? (
          <ChipRow>
            <Chip label="Camera" icon={<MaterialIcons name="photo-camera" size={16} color={c.primary} />} onPress={() => addImages("camera")} />
            <Chip label="Gallery" icon={<MaterialIcons name="photo-library" size={16} color={c.primary} />} onPress={() => addImages("gallery")} />
          </ChipRow>
        ) : null}
        <ErrorText>{errors.images}</ErrorText>

        {kind !== "wanted" ? (
          <>
            <TouchableOpacity
              onPress={() => setPrivateSeller(!privateSeller)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privateSeller }}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}
            >
              <MaterialIcons name={privateSeller ? "check-box" : "check-box-outline-blank"} size={26} color={c.primary} />
              <CustomText style={{ flex: 1 }}>I&apos;m selling as a private person, not as a business.</CustomText>
            </TouchableOpacity>
            <ErrorText>{errors.private}</ErrorText>
          </>
        ) : null}

        <CustomTextInput
          label="Description (optional)"
          placeholder="Anything else a buyer should know"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          containerStyle={{ maxHeight: 200 }}
        />
      </ScrollView>
    </CustomOverlay>
  );
}

function RemoveBadge({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel="Remove photo"
      style={{ position: "absolute", top: -6, right: -6, backgroundColor: c.background, borderRadius: 12 }}
    >
      <MaterialIcons name="cancel" size={24} color="red" />
    </TouchableOpacity>
  );
}

export default ListingFormOverlay;
