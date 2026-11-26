import { SectionHeader } from "@/src/components/custom_ui/card";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomDropdown from "@/src/components/custom_ui/custom_dropdown";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import showToast from "@/src/components/custom_ui/toast";
import { useCarriers } from "@/src/hooks/market_api";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { listingImageResize } from "@/src/const/image_resize_config";
import { pickImage } from "@/src/utils/data_access_utils";
import { resizeForUpload } from "@/src/utils/resize_photo";
import { LocalImage } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, Text, View } from "react-native";
import { Chip, ChipRow, ErrorText, WarningBanner } from "../ui/retro";

function PhotoPicker({ photo, onChange, label }: { photo: LocalImage | null; onChange: (p: LocalImage | null) => void; label: string }) {
  const { t } = useTranslation();
  const pick = async (source: "camera" | "gallery") => {
    const result = await pickImage(source);
    if (result.status === "success" && result.assets[0]) {
      // Resized on the phone (1600 px wide) for a fast upload; the server only resizes what arrives bigger.
      const a = await resizeForUpload(result.assets[0], listingImageResize);
      onChange({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType });
    } else if (result.status === "permission_denied") {
      showToast("error", t("market:photo.permissionTitle"), t("market:photo.permissionText"));
    }
  };
  return (
    <View style={{ gap: spacing.xs }}>
      <SectionHeader title={label} />
      {photo ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Image
            source={{ uri: photo.uri }}
            accessibilityLabel={t("market:photo.selected")}
            style={{ width: 96, height: 96, borderWidth: borders.width, borderColor: colors.border }}
          />
          <Chip label={t("market:photo.remove")} icon={<MaterialIcons name="close" size={18} color={colors.text} />} onPress={() => onChange(null)} />
        </View>
      ) : (
        <ChipRow>
          <Chip label={t("market:photo.camera")} icon={<MaterialIcons name="photo-camera" size={18} color={colors.text} />} onPress={() => pick("camera")} />
          <Chip label={t("market:photo.gallery")} icon={<MaterialIcons name="photo-library" size={18} color={colors.text} />} onPress={() => pick("gallery")} />
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
  const { t } = useTranslation();
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

  const code = tracking.trim();
  const error = !carrier
    ? t("market:ship.errorCarrier")
    : code.length < 4 || code.length > 40
      ? t("market:ship.errorLength")
      : !/^[A-Za-z0-9 -]+$/.test(code)
        ? t("market:ship.errorChars")
        : null;

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle={t("market:ship.title")}
      footerContent={
        <CustomButton title={t("market:ship.submit")} disabled={!!error || loading} loading={loading} onPress={() => onSubmit(carrier!, code, photo)} />
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <WarningBanner />
        <Text style={[typography.body, { color: colors.text }]}>{t("market:ship.explanation")}</Text>
        <SectionHeader title={t("market:ship.carrier")} />
        <CustomDropdown<string>
          value={carrier}
          open={open}
          setOpen={setOpen}
          setValue={setCarrier}
          items={carriers.map((x) => ({ label: x.label, value: x.code }))}
          placeholder={t("market:ship.chooseCarrier")}
          modalTitle={t("market:ship.carrier")}
        />
        <CustomTextInput
          label={t("market:ship.tracking")}
          required
          value={tracking}
          onChangeText={setTracking}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={40}
        />
        <PhotoPicker photo={photo} onChange={setPhoto} label={t("market:ship.photo")} />
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
  const { t } = useTranslation();
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  useEffect(() => {
    if (isVisible) setPhoto(null);
  }, [isVisible]);
  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle={t("market:receipt.title")}
      footerContent={<CustomButton title={t("market:receipt.submit")} disabled={loading} loading={loading} onPress={() => onSubmit(photo)} />}
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
        <Text style={[typography.body, { color: colors.text }]}>{t("market:receipt.explanation")}</Text>
        <PhotoPicker photo={photo} onChange={setPhoto} label={t("market:receipt.photo")} />
      </ScrollView>
    </CustomOverlay>
  );
}
