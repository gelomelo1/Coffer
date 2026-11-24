import { Chip, ChipRow } from "@/src/components/custom_ui/chip";
import showToast from "@/src/components/custom_ui/toast";
import { backendAxios } from "@/src/const/backendAccessConfiguration";
import { ROUTES } from "@/src/const/navigation_params";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { apiErrorMessage, countryFlag } from "@/src/utils/market_api";
import { signInWith } from "@/src/utils/session";
import { navigate } from "expo-router/build/global-state/routing";
import type { StoredSession } from "@/src/utils/token_store";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

interface DevLoginUser {
  id: string;
  name: string;
  country: string;
  provider: string;
  suspended: boolean;
}

/**
 * DEVELOPMENT ONLY: sign in as one of the seeded test users without a sign-in provider.
 * Rendered only in dev builds (__DEV__) and only when the backend exposes the dev login (Development environment +
 * DEV_LOGIN_ENABLED=true); otherwise the endpoint answers 404 and nothing is shown.
 */
function DevLogin() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<DevLoginUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!__DEV__) return;
    backendAxios
      .get<DevLoginUser[]>("api/auth/dev/users")
      .then((response) => setUsers(response.data))
      .catch(() => setUsers([])); // 404 = dev login switched off
  }, []);

  if (!__DEV__ || users.length === 0) return null;

  const signIn = async (user: DevLoginUser) => {
    setBusy(user.id);
    try {
      const { data } = await backendAxios.post<StoredSession>("api/auth/dev/login", { userId: user.id });
      await signInWith(data);
      showToast("success", t("auth:dev.signedInAs", { name: user.name }));
      navigate(ROUTES.ROOT);
    } catch (error) {
      showToast("error", t("auth:dev.failed"), apiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View
      style={{
        width: "100%",
        maxWidth: 420,
        alignSelf: "center",
        borderWidth: borders.width,
        borderStyle: "dashed",
        borderColor: colors.danger,
        padding: spacing.sm,
        gap: spacing.sm,
      }}
    >
      <Text style={[typography.label, { color: colors.danger, textTransform: "uppercase", letterSpacing: 0.5 }]}>{t("auth:dev.title")}</Text>
      <ChipRow>
        {users.map((u) => {
          const name = `${countryFlag(u.country)} ${u.name}`; // i18n-ignore
          return (
            <Chip
              key={u.id}
              label={u.suspended ? t("auth:dev.suspended", { name }) : name}
              disabled={!!busy && busy !== u.id}
              selected={busy === u.id}
              onPress={() => signIn(u)}
            />
          );
        })}
      </ChipRow>
    </View>
  );
}

export default DevLogin;
