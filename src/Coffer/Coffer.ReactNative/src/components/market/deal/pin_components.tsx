import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import i18n from "@/src/i18n";
import { borders, colors, fonts, sizes, spacing, typography } from "@/src/theme/theme";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, TextInput, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

/** Buyer side: 4-digit PIN + QR. Shown only after the buyer has checked the item. */
export function PinDisplay({ pin, qr }: { pin: string; qr: string }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ alignItems: "center", gap: spacing.sm }}>
      <Text style={[typography.body, { color: colors.text, textAlign: "center" }]}>{t("market:pin.checkFirst")}</Text>
      {revealed ? (
        <>
          <View accessible accessibilityLabel={t("market:pin.yourPin", { pin: pin.split("").join(" ") })} style={{ flexDirection: "row", gap: spacing.xs }}>
            {pin.split("").map((digit, i) => (
              <View
                key={i}
                style={{
                  width: 52,
                  height: 64,
                  borderWidth: borders.width,
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, color: colors.onSecondary }}>{digit}</Text>
              </View>
            ))}
          </View>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={t("market:pin.qrLabel")}
            style={{ padding: spacing.sm, backgroundColor: colors.surface, borderWidth: borders.width, borderColor: colors.border }}
          >
            <QRCode value={qr} size={180} color={colors.primary} backgroundColor={colors.surface} />
          </View>
          <CustomButton
            title={t("market:pin.hide")}
            variant="outline"
            icon={<MaterialIcons name="visibility-off" size={sizes.iconSm} color={colors.text} />}
            onPress={() => setRevealed(false)}
          />
        </>
      ) : (
        <CustomButton
          title={t("market:pin.show")}
          icon={<MaterialIcons name="visibility" size={sizes.iconSm} color={colors.onPrimary} />}
          onPress={() => setRevealed(true)}
          containerStyle={{ alignSelf: "stretch" }}
        />
      )}
    </View>
  );
}

/** Seller side: type the buyer's 4 digits or scan their QR code. */
export function PinEntry({ onSubmit, loading, lockedUntil }: { onSubmit: (pinOrQr: string) => void; loading: boolean; lockedUntil?: string | null }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [scanning, setScanning] = useState(false);
  const locked = !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.body, { color: colors.text }]}>{t("market:pin.askBuyer")}</Text>
      {locked ? (
        <Text accessibilityLiveRegion="polite" style={[typography.bodyStrong, { color: colors.danger }]}>
          {t("market:pin.locked", {
            time: new Date(lockedUntil!).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" }),
          })}
        </Text>
      ) : null}
      <TextInput
        value={pin}
        onChangeText={(v) => setPin(v.replace(/[^0-9]/g, "").slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="••••" // i18n-ignore
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t("market:pin.inputLabel")}
        editable={!locked}
        style={{
          alignSelf: "center",
          width: 180,
          minHeight: 64,
          textAlign: "center",
          letterSpacing: 16,
          fontSize: 32,
          fontFamily: fonts.bold,
          color: colors.text,
          borderWidth: borders.focus,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
      />
      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
        <CustomButton
          title={t("market:pin.scan")}
          variant="outline"
          icon={<MaterialIcons name="qr-code-scanner" size={sizes.iconSm} color={colors.text} />}
          disabled={locked || loading}
          onPress={() => setScanning(true)}
          containerStyle={{ flex: 1, minWidth: 140 }}
        />
        <CustomButton
          title={t("market:pin.confirm")}
          disabled={pin.length !== 4 || locked || loading}
          loading={loading}
          onPress={() => onSubmit(pin)}
          containerStyle={{ flex: 1, minWidth: 140 }}
        />
      </View>
      <QrScannerOverlay
        isVisible={scanning}
        onClose={() => setScanning(false)}
        onScanned={(value) => {
          setScanning(false);
          onSubmit(value);
        }}
      />
    </View>
  );
}

function QrScannerOverlay({ isVisible, onClose, onScanned }: { isVisible: boolean; onClose: () => void; onScanned: (value: string) => void }) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  useEffect(() => {
    if (isVisible) {
      handled.current = false;
      if (permission && !permission.granted && permission.canAskAgain) requestPermission();
    }
  }, [isVisible, permission, requestPermission]);

  return (
    <CustomOverlay isVisible={isVisible} onClose={onClose} overlayTitle={t("market:pin.scanTitle")}>
      {permission?.granted ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => {
            if (handled.current || !data?.startsWith("coffer-handoff:")) return;
            handled.current = true;
            onScanned(data);
          }}
        />
      ) : (
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          <Text style={[typography.body, { color: colors.text }]}>{t("market:pin.cameraNeeded")}</Text>
          <CustomButton title={t("market:pin.allowCamera")} onPress={requestPermission} />
        </View>
      )}
    </CustomOverlay>
  );
}
