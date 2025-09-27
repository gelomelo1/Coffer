import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  Text,
  View
} from "react-native";
import RegisterForm from "../components/login/registerform";
import { useGitHubAuth, useGoogleAuth } from "../hooks/auth";
import { customTheme } from "../theme/theme";

function Login() {

  const [provider, setProvider] = useState<"google" | "github" | null>(null);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false);
  const [
    isRegistrationSuccessSnackbarVisible,
    setIsRegistrationSuccessSnackbarVisible,
  ] = useState(false);
  const [isLoginSuccessSnackbarVisible, setIsLoginSuccessSnackbarVisible] =
    useState(false);

  const handleUserNotExists = (exists: boolean | null) => {
    if (exists === false) {
      setIsUsernameModalOpen(true);
    }
  };

  const handleSuccessfulRegistration = () => {
    setIsUsernameModalOpen(false);
    setIsRegistrationSuccessSnackbarVisible(true);
  };

  const handleSuccessfulLogin = () => {
    setIsLoginSuccessSnackbarVisible(true);
  };

  const { promptAsync: googlePrompt, submitRegistration: googleSubmitRegistration } = useGoogleAuth({
    onUserExistsChange: handleUserNotExists,
    onSuccessfulRegistration: handleSuccessfulRegistration,
    onSuccessfulLogin: handleSuccessfulLogin,
  });

  const {promptAsync: githubPrompt, submitRegistration: githubSubmitRegistration} = useGitHubAuth({
    onUserExistsChange: handleUserNotExists,
    onSuccessfulRegistration: handleSuccessfulRegistration,
    onSuccessfulLogin: handleSuccessfulLogin,
  });

  const handleGooglePress = () => {
    setProvider("google");
    googlePrompt();
  }

  const handleGithubPress = () => {
    setProvider("github");
      githubPrompt();
  }

  const handleSubmitRegistration = async (username: string) => {
    if (provider === "google") {
      await googleSubmitRegistration(username);
    } else if (provider === "github") {
      await githubSubmitRegistration(username);
    }
  }

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
          <Text
            style={{
              color: customTheme.colors.primary,
              fontSize: 34,
              fontFamily: "VendSansBold",
            }}
          >
            Helloo
          </Text>
          <Text
            style={{
              color: customTheme.colors.primary,
              fontSize: 16,
              fontFamily: "VendSans",
            }}
          >
            Please sign in, with one of the following
          </Text>
          <Pressable
            onPress={handleGooglePress}
            style={{
              width: "60%",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: customTheme.colors.primary,
              padding: 5,
              borderWidth: 1,
              borderColor: customTheme.colors.secondary,
              boxShadow: `1px 1px ${customTheme.colors.secondary}`,
            }}
          >
            <Image source={require("../../assets/images/googlesignin.png")} />
            <Text style={{ color: customTheme.colors.secondary }}>
              Sign in with Google
            </Text>
          </Pressable>
          <Pressable
            onPress={handleGithubPress}
            style={{
              width: "60%",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: customTheme.colors.primary,
              padding: 5,
              borderWidth: 1,
              borderColor: customTheme.colors.secondary,
              boxShadow: `1px 1px ${customTheme.colors.secondary}`,
            }}
          >
            <Image source={require("../../assets/images/githubsignin.png")} />
            <Text style={{ color: customTheme.colors.secondary }}>
              Sign in with Github
            </Text>
          </Pressable>
        </View>
      </View>
      <Modal
        visible={isUsernameModalOpen}
        onRequestClose={() => setIsUsernameModalOpen(false)}
      >
        <RegisterForm submitRegistration={handleSubmitRegistration} />
      </Modal>
    </>
  );
}

export default Login;
