import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import showToast from "@/src/components/custom_ui/toast";
import { useCarriers } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { pickImage } from "@/src/utils/data_access_utils";
import { LocalImage } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { Chip, ChipRow, ErrorText, Label, WarningBanner } from "../ui/retro";

const c = customTheme.colors;

function PhotoPicker({ photo, onChange, label }: { photo: LocalImage | null; onChange: (p: LocalImage | null) => void; label: string }) {
  const pick = async (source: "camera" | "gallery") => {
    const result = await pickImage(source, { quality: 0.6 });
    if (result.status === "success" && result.assets[0]) {
      const a = result.assets[0];
      onChange({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType });
    } else if (result.status === "permission_denied") {
      showToast("error", "Permission needed", "Allow camera / photo access in the system settings.");
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      {photo ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Image source={{ uri: photo.uri }} style={{ width: 90, height: 90 }} />
          <Chip label="Remove" onPress={() => onChange(null)} />
        </View>
      ) : (
        <ChipRow>
          <Chip label="Camera" icon={<MaterialIcons name="photo-camera" size={16} color={c.primary} />} onPress={() => pick("camera")} />
          <Chip label="Gallery" icon={<MaterialIcons name="photo-library" size={16} color={c.primary} />} onPress={() => pick("gallery")} />
        </ChipRow>
      )}
    </View>
  );
}

/** Seller registers the shipment: carrier + tracking number (+ optional parcel photo). */
export function ShipOverlay({
  isVisible,
  onClose,
  loading,
  onSubmit,
}: {
  isVisible: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (carrier: string, tracking: string, photo: LocalImage | null) => void;
}) {
  const { data: carriers = [] } = useCarriers();
  const [carrier, setCarrier] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState("");
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  useEffect(() => {
    if (isVisible) {
      setCarrier(null);
      setTracking("");
      setPhoto(null);
    }
  }, [isVisible]);

  const t = tracking.trim();
  const error = !carrier
    ? "Choose the carrier."
    : t.length < 4 || t.length > 40
      ? "Tracking number: 4–40 characters."
      : !/^[A-Za-z0-9 -]+$/.test(t)
        ? "Only letters, digits, spaces and dashes."
        : null;

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle="Register shipment"
      footerContent={
        <View style={{ width: "90%" }}>
          <CustomButton title="Mark as shipped" disabled={!!error || loading} loading={loading} onPress={() => onSubmit(carrier!, t, photo)} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
        <WarningBanner />
        <CustomText>
          The buyer will see the carrier and tracking number and can check it on the carrier&apos;s website. If the buyer
          doesn&apos;t confirm or report a problem within 14 days, the deal completes automatically.
        </CustomText>
        <Label>Carrier</Label>
        <CustomDropdown<string>
          value={carrier}
          open={open}
          setOpen={setOpen}
          setValue={setCarrier}
          items={carriers.map((x) => ({ label: x.label, value: x.code }))}
          placeholder="Choose carrier"
          modalTitle="Carrier"
        />
        <CustomTextInput label="Tracking number" value={tracking} onChangeText={setTracking} autoCapitalize="characters" maxLength={40} />
        <PhotoPicker photo={photo} onChange={setPhoto} label="Photo of the packed item (optional)" />
        <ErrorText>{error}</ErrorText>
      </ScrollView>
    </CustomOverlay>
  );
}

/** Buyer confirms the parcel arrived (+ optional photo of its condition). */
export function ReceiptOverlay({
  isVisible,
  onClose,
  loading,
  onSubmit,
}: {
  isVisible: boolean;
  onClose: () => void;
  loading: boolean;
  onSubmit: (photo: LocalImage | null) => void;
}) {
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  useEffect(() => {
    if (isVisible) setPhoto(null);
  }, [isVisible]);
  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle="Confirm receipt"
      footerContent={
        <View style={{ width: "90%" }}>
          <CustomButton title="I received the item" disabled={loading} loading={loading} onPress={() => onSubmit(photo)} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 12, gap: 8 }}>
        <CustomText>
          Confirm only when the parcel is in your hands. This completes the deal; if something is wrong, use “Report a
          problem” instead.
        </CustomText>
        <PhotoPicker photo={photo} onChange={setPhoto} label="Photo of the item's condition (optional)" />
      </ScrollView>
    </CustomOverlay>
  );
}
