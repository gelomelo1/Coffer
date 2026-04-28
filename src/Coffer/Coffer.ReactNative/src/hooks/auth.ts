import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GoogleSignin,
  SignInResponse,
} from "@react-native-google-signin/google-signin";
import * as AuthSession from "expo-auth-session";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";
import { asyncstoragekeys } from "../const/async_storage_keys";
import {
  githubClientId,
  redirectUriScheme,
  webGoogleClientId,
} from "../const/authAccessConfiguration";
import { endpoints } from "../const/endpoints";
import { ROUTES } from "../const/navigation_params";
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
  GoogleSignin.configure({
    webClientId: webGoogleClientId,
    offlineAccess: true,
    scopes: ["profile", "email"],
  });

  const [googleResponse, setGoogleResponse] = useState<SignInResponse | null>(
    null,
  );
  const [tempId, setTempId] = useState<string | null>(null);

  const googlePrompt = async () => {
    try {
      const userInfo = await GoogleSignin.signIn();
      setGoogleResponse(userInfo);
      return userInfo;
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      return null;
    }
  };

  const signOut = async () => {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch (error) {
      console.error("Error signing out from Google:", error);
    }
  };

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (googleResponse?.data?.idToken) {
        try {
          const validation = await postData<
            { idToken: string },
            { exists: boolean; token?: string; tempId: string }
          >(endpoints.googleValidate, { idToken: googleResponse.data.idToken });

          onUserExistsChange?.(validation.exists);

          if (validation.exists && validation.token) {
            await AsyncStorage.setItem(asyncstoragekeys.jwt, validation.token);
            onSuccessfulLogin?.();
            navigate(ROUTES.ROOT);
          } else if (!validation.exists && validation.tempId) {
            setTempId(validation.tempId);
          }
        } catch (error) {
          console.error("Google auth error:", error);
        }
      }
    };

    handleGoogleResponse();
  }, [googleResponse, onSuccessfulLogin, onUserExistsChange]);

  const submitRegistration = async (username: string, country: string) => {
    if (!tempId) return;
    try {
      const jwtResp = await postData<
        { tempId: string; username: string; country: string },
        { token: string }
      >(endpoints.googleRegister, { tempId, username, country });
      await AsyncStorage.setItem(asyncstoragekeys.jwt, jwtResp.token);
      onSuccessfulRegistration?.();
      navigate(ROUTES.ROOT);
    } catch (error) {
      console.error("Registration failed:", error);
    }
  };

  return { promptAsync: googlePrompt, submitRegistration, signOut };
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
    { authorizationEndpoint: "https://github.com/login/oauth/authorize" },
  );

  const [tempId, setTempId] = useState<string | null>(null);

  useEffect(() => {
    const handleGitHubResponse = async () => {
      if (response?.type === "success") {
        const codeFromGitHub = response.params?.code;
        const githubCodeVerifier = request?.codeVerifier;
        if (!codeFromGitHub || !githubCodeVerifier) return;

        try {
          const validation = await postData<
            { code: string; codeVerifier: string },
            { exists: boolean; token?: string; tempId?: string }
          >(endpoints.githubValidate, {
            code: codeFromGitHub,
            codeVerifier: githubCodeVerifier,
          });

          onUserExistsChange?.(validation.exists);

          if (validation.exists && validation.token) {
            await AsyncStorage.setItem(asyncstoragekeys.jwt, validation.token);
            onSuccessfulLogin?.();
            navigate(ROUTES.ROOT);
          } else if (!validation.exists && validation.tempId) {
            setTempId(validation.tempId);
          }
        } catch (error) {
          console.error("GitHub auth error:", error);
        }
      }
    };
    handleGitHubResponse();
  }, [onSuccessfulLogin, onUserExistsChange, request?.codeVerifier, response]);

  const submitRegistration = async (username: string, country: string) => {
    if (!tempId) return;
    try {
      const jwtResp = await postData<
        { tempId: string; username: string; country: string },
        { token: string }
      >(endpoints.githubRegister, { tempId, username, country });
      await AsyncStorage.setItem(asyncstoragekeys.jwt, jwtResp.token);
      onSuccessfulRegistration?.();
      navigate(ROUTES.ROOT);
    } catch (error) {
      console.error("GitHub registration failed:", error);
    }
  };

  return { promptAsync, submitRegistration };
}
