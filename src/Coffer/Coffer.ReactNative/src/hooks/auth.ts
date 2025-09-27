import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";
import {
  androidGoogleClientId,
  githubClientId,
  redirectUriScheme,
  webGoogleClientId,
} from "../const/authAccessConfiguration";
import { endpoints } from "../const/endpoints";
import { postData } from "../utils/backend_access";

const reidrectUri = AuthSession.makeRedirectUri({
  scheme: redirectUriScheme,
});

interface useGoogleAuthProps {
  onUserExistsChange?: (exists: boolean | null) => void;
  onSuccessfulRegistration?: () => void;
  onSuccessfulLogin?: () => void;
}

export function useGoogleAuth({
  onUserExistsChange,
  onSuccessfulRegistration,
  onSuccessfulLogin,
}: useGoogleAuthProps) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: webGoogleClientId,
    androidClientId: androidGoogleClientId,
    responseType: "id_token",
    redirectUri: reidrectUri,
  });

  const [tempId, setTempId] = useState<string | null>(null);

  // Handle Google response
  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type === "success") {
        const token = response.params?.id_token;
        if (!token) return;

        try {
          const validation = await postData<
            { idToken: string },
            { exists: boolean; token?: string; tempId: string }
          >(endpoints.googleValidate, { idToken: token });

          onUserExistsChange?.(validation.exists);

          // If user exists, login automatically
          if (validation.exists && validation.token) {
            await AsyncStorage.setItem("jwt", validation.token);
            onSuccessfulLogin?.();
            navigate("/");
          } else if (!validation.exists && validation.tempId) {
            setTempId(validation.tempId);
          }
        } catch (error) {
          console.error("Google auth error:", error);
        }
      }
    };

    handleGoogleResponse();
  }, [response]);

  // Submit registration manually with username
  const submitRegistration = async (username: string) => {
    if (!tempId) return;
    try {
      const jwtResp = await postData<
        { tempId: string; username: string },
        { token: string }
      >(endpoints.googleRegister, { tempId, username });
      await AsyncStorage.setItem("jwt", jwtResp.token);
      onSuccessfulRegistration?.();
      navigate("/");
    } catch (error) {
      console.error("Registration failed:", error);
    }
  };

  return { promptAsync, submitRegistration };
}

export function useGitHubAuth({
  onUserExistsChange,
  onSuccessfulRegistration,
  onSuccessfulLogin,
}: {
  onUserExistsChange?: (exists: boolean | null) => void;
  onSuccessfulRegistration?: () => void;
  onSuccessfulLogin?: () => void;
}) {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: githubClientId,
      scopes: ["read:user", "user:email"],
      redirectUri: reidrectUri,
      usePKCE: true,
    },
    { authorizationEndpoint: "https://github.com/login/oauth/authorize" }
  );

  const [tempId, setTempId] = useState<string | null>(null);

  // Handle GitHub response
  useEffect(() => {
    const handleGitHubResponse = async () => {
      if (response?.type === "success") {
        const codeFromGitHub = response.params?.code;
        const githubCodeVerifier = request?.codeVerifier;
        if (!codeFromGitHub || !githubCodeVerifier) return;

        try {
          // Send code to your backend to exchange for token & check user
          const validation = await postData<
            { code: string; codeVerifier: string },
            { exists: boolean; token?: string; tempId?: string }
          >(endpoints.githubValidate, {
            code: codeFromGitHub,
            codeVerifier: githubCodeVerifier,
          });

          onUserExistsChange?.(validation.exists);

          if (validation.exists && validation.token) {
            await AsyncStorage.setItem("jwt", validation.token);
            onSuccessfulLogin?.();
            navigate("/");
          } else if (!validation.exists && validation.tempId) {
            setTempId(validation.tempId);
          }
        } catch (error) {
          console.error("GitHub auth error:", error);
        }
      }
    };
    handleGitHubResponse();
  }, [response]);

  // Manual registration
  const submitRegistration = async (username: string) => {
    if (!tempId) return;
    try {
      const jwtResp = await postData<
        { tempId: string; username: string },
        { token: string }
      >(endpoints.githubRegister, { tempId, username });
      await AsyncStorage.setItem("jwt", jwtResp.token);
      onSuccessfulRegistration?.();
      navigate("/");
    } catch (error) {
      console.error("GitHub registration failed:", error);
    }
  };

  return { promptAsync, submitRegistration };
}
