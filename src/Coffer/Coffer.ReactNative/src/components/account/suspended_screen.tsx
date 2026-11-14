import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { ROUTES } from "@/src/const/navigation_params";
import { useResetNavigation } from "@/src/hooks/navigation";
import { useSuspensionStore } from "@/src/hooks/suspension_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import { formatDateTime, marketApi } from "@/src/utils/market_api";
import { removeToken } from "@/src/utils/token_store";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { useState } from "react";
import { View } from "react-native";

const c = customTheme.colors;

/**
 * Covers the whole app while the account is suspended. The block itself is enforced by the backend (every request
 * answers 403 account_suspended); this screen only explains why and until when.
 */
function SuspendedScreen() {
  const { suspension, setSuspension } = useSuspensionStore();
  const { user } = useUserStore();
  const resetNavigate = useResetNavigation();
  const [checking, setChecking] = useState(false);

  if (!suspension) return null;

  const checkAgain = async () => {
    setChecking(true);
    try {
      setSuspension(await marketApi.accountSuspension());
    } catch {
      // still suspended or offline: keep the screen
    } finally {
      setChecking(false);
    }
  };

  const signOut = async () => {
    try {
      if (user?.provider === "google") await GoogleSignin.signOut();
      await removeToken();
    } catch {}
    setSuspension(null);
    resetNavigate(ROUTES.ROOT);
  };

  return (
    <View
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: c.background,
        justifyContent: "center",
        padding: 24,
        gap: 14,
        zIndex: 1000,
      }}
    >
      <MaterialIcons name="block" size={64} color={c.primary} style={{ alignSelf: "center" }} />
      <CustomText style={{ fontFamily: "VendSansBold", fontSize: 24, textAlign: "center" }}>Your account is suspended</CustomText>
      <View style={{ borderWidth: 2, borderColor: c.primary, boxShadow: `3px 3px ${c.primary}`, backgroundColor: c.secondary, padding: 12, gap: 6 }}>
        <CustomText style={{ fontFamily: "VendSansBold" }}>Until {formatDateTime(suspension.endsAt)}</CustomText>
        <CustomText>Reason: {suspension.reason}</CustomText>
      </View>
      <CustomText style={{ fontSize: 14, textAlign: "center" }}>
        A Coffer administrator suspended your account for breaking the community rules. You can use Coffer again when the
        suspension ends.
      </CustomText>
      <CustomButton title="Check again" loading={checking} onPress={checkAgain} />
      <CustomButton title="Sign out" onPress={signOut} />
    </View>
  );
}

export default SuspendedScreen;
