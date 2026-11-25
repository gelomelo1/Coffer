import * as WebBrowser from "expo-web-browser";
import { navigate } from "expo-router/build/global-state/routing";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import showToast from "../components/custom_ui/toast";
import { endpoints } from "../const/endpoints";
import { ROUTES } from "../const/navigation_params";
import { apiErrorText } from "../utils/api_error_text";
import { parseAuthResult, queryParam } from "../utils/auth_redirect";
import { postData } from "../utils/backend_access";
import { env } from "../const/env";
import { GoogleSignin, googleSignInEnabled } from "../utils/google_signin";
import { signInWith } from "../utils/session";
import type { StoredSession } from "../utils/token_store";

export type SignInProvider = "google" | "facebook" | "discord" | "github";
type BrowserProvider = Exclude<SignInProvider, "google">;

/** The backend's answer to every provider's sign-in step. */
type SignInAnswer =
  | ({ status: "signedIn" } & StoredSession)
  | { status: "registrationRequired"; registrationId: string };

type OAuthStart = { transactionId: string; authorizeUrl: string; redirectUri: string };

const BROWSER: Record<BrowserProvider, { start: string; complete: string }> = {
  facebook: { start: endpoints.facebookStart, complete: endpoints.facebookComplete },
  discord: { start: endpoints.discordStart, complete: endpoints.discordComplete },
  github: { start: endpoints.githubStart, complete: endpoints.githubComplete },
};

interface UseSignInProps {
  /** A new identity: show the registration form (username + country). */
  onRegistrationRequired: (provider: SignInProvider) => void;
  onSignedIn?: () => void;
  onRegistered?: () => void;
}

/**
 * Google (native sign-in, ID token checked by the backend), Facebook, Discord and GitHub (in-app browser; the backend builds
 * the sign-in URL and holds the state, nonce and PKCE verifier). All three end in the backend's shared answer:
 * signed in, or registration required. Tokens are never logged.
 */
export function useSignIn({ onRegistrationRequired, onSignedIn, onRegistered }: UseSignInProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ provider: SignInProvider; registrationId: string } | null>(null);

  const finish = async (provider: SignInProvider, answer: SignInAnswer) => {
    if (answer.status === "signedIn") {
      await signInWith(answer);
      onSignedIn?.();
      navigate(ROUTES.ROOT);
    } else {
      setPending({ provider, registrationId: answer.registrationId });
      onRegistrationRequired(provider);
    }
  };

  const failed = (error: unknown) => showToast("error", t("auth:login.failed"), apiErrorText(error));
  // Debug builds may leave a sign-in id out of .env: that sign-in is off (release builds require every id).
  const notConfigured = () => showToast("info", t("auth:login.notConfigured"));
  const appIdSet: Record<BrowserProvider, boolean> = {
    facebook: env.facebookAppId !== null,
    discord: env.discordAppId !== null,
    github: true, // nothing app-side: the backend says when it isn't set up
  };

  const run = async (provider: SignInProvider, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  };

  const google = () =>
    run("google", async () => {
      if (!googleSignInEnabled) return notConfigured();
      let idToken: string | null | undefined;
      try {
        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();
        if (response.type !== "success") return; // cancelled
        idToken = response.data.idToken;
      } catch {
        showToast("error", t("auth:login.failed"));
        return;
      }
      if (!idToken) return;
      await finish("google", await postData<{ idToken: string }, SignInAnswer>(endpoints.googleValidate, { idToken }));
    });

  const browser = (provider: BrowserProvider) =>
    run(provider, async () => {
      if (!appIdSet[provider]) return notConfigured();
      const start = await postData<Record<string, never>, OAuthStart>(BROWSER[provider].start, {});
      const expectedState = queryParam(start.authorizeUrl, "state") ?? "";
      const result = await WebBrowser.openAuthSessionAsync(start.authorizeUrl, start.redirectUri);
      const redirect = parseAuthResult(result, expectedState, start.redirectUri);
      if (redirect.kind === "cancelled") {
        showToast("info", t("auth:login.cancelled"));
        return;
      }
      if (redirect.kind === "error") {
        showToast("error", t("auth:login.failed"));
        return;
      }
      await finish(
        provider,
        await postData<{ transactionId: string; code: string; state: string }, SignInAnswer>(BROWSER[provider].complete, {
          transactionId: start.transactionId,
          code: redirect.code,
          state: redirect.state,
        }),
      );
    });

  const register = async (username: string, country: string) => {
    if (!pending) return;
    try {
      const tokens = await postData<{ registrationId: string; username: string; country: string }, StoredSession>(endpoints.authRegister, {
        registrationId: pending.registrationId,
        username,
        country,
      });
      setPending(null);
      await signInWith(tokens);
      onRegistered?.();
      navigate(ROUTES.ROOT);
    } catch (error) {
      failed(error);
    }
  };

  /** Closing the registration form drops the pending registration (and the Google session it came from). */
  const cancelRegistration = async () => {
    if (pending?.provider === "google") {
      try {
        await GoogleSignin.signOut();
      } catch {
        // Already signed out.
      }
    }
    setPending(null);
  };

  return {
    google,
    facebook: () => browser("facebook"),
    discord: () => browser("discord"),
    github: () => browser("github"),
    register,
    cancelRegistration,
    busy,
  };
}
