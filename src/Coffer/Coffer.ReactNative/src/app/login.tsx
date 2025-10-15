import { useState } from "react";
import { Image, Modal, View } from "react-native";
import CustomButton from "../components/custom_ui/custom_button";
import CustomText from "../components/custom_ui/custom_text";
import showToast from "../components/custom_ui/toast";
import RegisterForm from "../components/login/registerform";
import { useGitHubAuth, useGoogleAuth } from "../hooks/auth";
import { customTheme } from "../theme/theme";

function Login() {
  const [provider, setProvider] = useState<"google" | "github" | null>(null);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);

  const handleUserNotExists = (exists: boolean | null) => {
    if (exists === false) {
      setIsUsernameModalOpen(true);
    }
  };

  const handleSuccessfulRegistration = () => {
    setIsUsernameModalOpen(false);
    showToast("success", "Registration was successful", "Logging you in...");
  };

  const handleSuccessfulLogin = () => {
    showToast("success", "Authorization was successful", "Logging you in...");
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

  const {
    promptAsync: githubPrompt,
    submitRegistration: githubSubmitRegistration,
  } = useGitHubAuth({
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

  const handleSubmitRegistration = async (
    username: string,
    country: string
  ) => {
    if (provider === "google") {
      await googleSubmitRegistration(username, country);
    } else if (provider === "github") {
      await githubSubmitRegistration(username, country);
    }
  };

  const handleCloseRegistrationModal = async () => {
    console.log("Signing out from provider:", provider);
    if (provider === "google") await googleSignOut();
    setIsUsernameModalOpen(false);
  };

  return (
    <>
      <View
        style={{
          flex: 1,
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: customTheme.colors.background,
          paddingVertical: 100,
        }}
      >
        <Image
          source={require("../../assets/images/iconwithlabel.png")}
          style={{ width: "60%", height: "auto", aspectRatio: "1/1" }}
        />
        <View style={{ width: "100%", gap: 10, alignItems: "center" }}>
          <CustomText style={{ fontSize: 34, fontFamily: "VendSansBold" }}>
            Helloo
          </CustomText>
          <CustomText>Please sign in, with one of the following</CustomText>
          <CustomButton
            onPress={handleGooglePress}
            title="Sign in with Google"
            icon={
              <Image
                source={require("../../assets/images/googlesignin.png")}
                style={{ width: 32, height: 32, marginRight: 10 }}
              />
            }
            containerStyle={{ width: "60%", alignSelf: "center" }}
          />
          <CustomButton
            onPress={handleGithubPress}
            title="Sign in with Github"
            icon={
              <Image
                source={require("../../assets/images/githubsignin.png")}
                style={{ width: 32, height: 32, marginRight: 10 }}
              />
            }
            containerStyle={{ width: "60%", alignSelf: "center" }}
          />
        </View>
      </View>
      <Modal
        visible={isUsernameModalOpen}
        onRequestClose={handleCloseRegistrationModal}
      >
        <RegisterForm submitRegistration={handleSubmitRegistration} />
      </Modal>
    </>
  );
}

export default Login;
