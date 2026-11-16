import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../components/custom_ui/custom_button";
import showToast from "../components/custom_ui/toast";
import DevLogin from "../components/login/dev_login";
import RegisterForm from "../components/login/registerform";
import { useGitHubAuth, useGoogleAuth } from "../hooks/auth";
import { colors, spacing, typography } from "../theme/theme";

function Login() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<"google" | "github" | null>(null);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);

  const handleUserNotExists = (exists: boolean | null) => {
    if (exists === false) setIsUsernameModalOpen(true);
  };

  const handleSuccessfulRegistration = () => {
    setIsUsernameModalOpen(false);
    showToast("success", t("auth:login.registrationSuccess"), t("auth:login.loggingIn"));
  };

  const handleSuccessfulLogin = () => {
    showToast("success", t("auth:login.loginSuccess"), t("auth:login.loggingIn"));
  };

  const {
    promptAsync: googlePrompt,
    submitRegistration: googleSubmitRegistration,
    signOut: googleSignOut,
  } = useGoogleAuth({
    onUserExistsChange: handleUserNotExists,
    onSuccessfulRegistration: handleSuccessfulRegistration,
    onSuccessfulLogin: handleSuccessfulLogin,
  });

  const { promptAsync: githubPrompt, submitRegistration: githubSubmitRegistration } = useGitHubAuth({
    onUserExistsChange: handleUserNotExists,
    onSuccessfulRegistration: handleSuccessfulRegistration,
    onSuccessfulLogin: handleSuccessfulLogin,
  });

  const handleGooglePress = () => {
    setProvider("google");
    googlePrompt();
  };

  const handleGithubPress = () => {
    setProvider("github");
    githubPrompt();
  };

  const handleSubmitRegistration = async (username: string, country: string) => {
    if (provider === "google") await googleSubmitRegistration(username, country);
    else if (provider === "github") await githubSubmitRegistration(username, country);
  };

  const handleCloseRegistrationModal = async () => {
    if (provider === "google") await googleSignOut();
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
              onPress={handleGooglePress}
              title={t("auth:login.google")}
              icon={providerIcon(require("../../assets/images/googlesignin.png"))}
            />
            <CustomButton
              variant="outline"
              onPress={handleGithubPress}
              title={t("auth:login.github")}
              icon={<FontAwesome name="github" size={26} color={colors.text} />}
            />
          </View>
          <DevLogin />
        </ScrollView>
      </SafeAreaView>
      <Modal visible={isUsernameModalOpen} onRequestClose={handleCloseRegistrationModal} animationType="slide">
        <RegisterForm submitRegistration={handleSubmitRegistration} onCancel={handleCloseRegistrationModal} />
      </Modal>
    </>
  );
}

export default Login;
