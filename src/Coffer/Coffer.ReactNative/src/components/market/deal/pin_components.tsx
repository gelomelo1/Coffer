import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomText from "@/src/components/custom_ui/custom_text";
import { customTheme } from "@/src/theme/theme";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

const c = customTheme.colors;

/** Buyer side: 4-digit PIN + QR. Shown only after the buyer has checked the item. */
export function PinDisplay({ pin, qr }: { pin: string; qr: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <CustomText style={{ textAlign: "center" }}>
        Check the item first. Only then show this code to the seller — it completes the deal and unlocks reviews.
      </CustomText>
      {revealed ? (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {pin.split("").map((digit, i) => (
              <View key={i} style={{ width: 48, height: 60, borderWidth: 2, borderColor: c.primary, backgroundColor: c.secondary, justifyContent: "center", alignItems: "center", boxShadow: `2px 2px ${c.primary}` }}>
                <CustomText style={{ fontFamily: "VendSansBold", fontSize: 30 }}>{digit}</CustomText>
              </View>
            ))}
          </View>
          <View style={{ padding: 8, backgroundColor: c.background, borderWidth: 2, borderColor: c.primary }}>
            <QRCode value={qr} size={170} color={c.primary} backgroundColor={c.background} />
          </View>
          <CustomButton title="Hide code" onPress={() => setRevealed(false)} />
        </>
      ) : (
        <CustomButton title="I checked the item — show my PIN" onPress={() => setRevealed(true)} />
      )}
    </View>
  );
}

/** Seller side: type the buyer's 4 digits or scan their QR code. */
export function PinEntry({ onSubmit, loading, lockedUntil }: { onSubmit: (pinOrQr: string) => void; loading: boolean; lockedUntil?: string | null }) {
  const [pin, setPin] = useState("");
  const [scanning, setScanning] = useState(false);
  const locked = !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();

  return (
    <View style={{ gap: 8 }}>
      <CustomText>Ask the buyer for their 4-digit PIN once they checked the item, then enter it here.</CustomText>
      {locked ? (
        <CustomText style={{ color: "red" }}>
          Too many wrong tries. Try again after {new Date(lockedUntil!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
        </CustomText>
      ) : null}
      <TextInput
        value={pin}
        onChangeText={(v) => setPin(v.replace(/[^0-9]/g, "").slice(0, 4))}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="••••"
        placeholderTextColor={c.accent}
        accessibilityLabel="Buyer PIN"
        style={{
          alignSelf: "center",
          width: 160,
          textAlign: "center",
          letterSpacing: 16,
          fontSize: 32,
          fontFamily: "VendSansBold",
          color: c.primary,
          borderWidth: 2,
          borderColor: c.primary,
          backgroundColor: c.secondary,
          boxShadow: `2px 2px ${c.primary}`,
        }}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <CustomButton title="Scan QR" disabled={locked || loading} onPress={() => setScanning(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <CustomButton
            title="Confirm handoff"
            disabled={pin.length !== 4 || locked || loading}
            loading={loading}
            onPress={() => onSubmit(pin)}
          />
        </View>
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
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  useEffect(() => {
    if (isVisible) {
      handled.current = false;
      if (permission && !permission.granted && permission.canAskAgain) requestPermission();
    }
  }, [isVisible, permission, requestPermission]);

  return (
    <CustomOverlay isVisible={isVisible} onClose={onClose} overlayTitle="Scan the buyer's QR code">
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
        <View style={{ padding: 20, gap: 12 }}>
          <CustomText>Camera access is needed to scan the code. You can also type the 4-digit PIN instead.</CustomText>
          <CustomButton title="Allow camera" onPress={requestPermission} />
        </View>
      )}
    </CustomOverlay>
  );
}
