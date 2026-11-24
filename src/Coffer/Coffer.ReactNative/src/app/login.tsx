import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../components/custom_ui/custom_button";
import showToast from "../components/custom_ui/toast";
import DevLogin from "../components/login/dev_login";
import RegisterForm from "../components/login/registerform";
import { useSignIn } from "../hooks/auth";
import { colors, spacing, typography } from "../theme/theme";

function Login() {
  const { t } = useTranslation();
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);

  const signIn = useSignIn({
    onRegistrationRequired: () => setIsUsernameModalOpen(true),
    onSignedIn: () => showToast("success", t("auth:login.loginSuccess"), t("auth:login.loggingIn")),
    onRegistered: () => {
      setIsUsernameModalOpen(false);
      showToast("success", t("auth:login.registrationSuccess"), t("auth:login.loggingIn"));
    },
  });

  const handleCloseRegistrationModal = async () => {
    await signIn.cancelRegistration();
    setIsUsernameModalOpen(false);
  };

  const providerIcon = (source: number) => <Image source={source} style={{ width: 24, height: 24 }} accessibilityIgnoresInvertColors />;

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require("../../assets/images/iconwithlabel.png")}
            style={{ width: "50%", maxWidth: 240, height: undefined, aspectRatio: 1, alignSelf: "center" }}
            accessibilityIgnoresInvertColors
            accessibilityLabel={t("common:appName")}
          />
          <View style={{ gap: spacing.xs }}>
            <Text accessibilityRole="header" style={[typography.display, { color: colors.text, textAlign: "center" }]}>
              {t("auth:login.title")}
            </Text>
            <Text style={[typography.body, { color: colors.text, textAlign: "center" }]}>{t("auth:login.subtitle")}</Text>
          </View>
          <View style={{ gap: spacing.md, width: "100%", maxWidth: 420, alignSelf: "center" }}>
            <CustomButton
              variant="outline"
              onPress={signIn.google}
              disabled={signIn.busy}
              title={t("auth:login.google")}
              icon={providerIcon(require("../../assets/images/googlesignin.png"))}
            />
            <CustomButton
              variant="outline"
              onPress={signIn.facebook}
              disabled={signIn.busy}
              title={t("auth:login.facebook")}
              icon={<FontAwesome name="facebook-official" size={26} color="#1877F2" />}
            />
            <CustomButton
              variant="outline"
              onPress={signIn.reddit}
              disabled={signIn.busy}
              title={t("auth:login.reddit")}
              icon={<FontAwesome name="reddit" size={26} color="#FF4500" />}
            />
          </View>
          <DevLogin />
        </ScrollView>
      </SafeAreaView>
      <Modal visible={isUsernameModalOpen} onRequestClose={handleCloseRegistrationModal} animationType="slide">
        <RegisterForm submitRegistration={signIn.register} onCancel={handleCloseRegistrationModal} />
      </Modal>
    </>
  );
}

export default Login;
