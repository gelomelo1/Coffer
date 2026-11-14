import CustomText from "@/src/components/custom_ui/custom_text";
import showToast from "@/src/components/custom_ui/toast";
import { backendAxios } from "@/src/const/backendAccessConfiguration";
import { ROUTES } from "@/src/const/navigation_params";
import { customTheme } from "@/src/theme/theme";
import { apiErrorMessage, countryFlag } from "@/src/utils/market_api";
import { setToken } from "@/src/utils/token_store";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

const c = customTheme.colors;

interface DevLoginUser {
  id: string;
  name: string;
  country: string;
  provider: string;
  suspended: boolean;
}

/**
 * DEVELOPMENT ONLY: sign in as one of the seeded test users without Google/GitHub.
 * Rendered only in dev builds (__DEV__) and only when the backend exposes the dev login (Development environment +
 * DEV_LOGIN_ENABLED=true); otherwise the endpoint answers 404 and nothing is shown.
 */
function DevLogin() {
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
      const { data } = await backendAxios.post<{ token: string }>("api/auth/dev/login", { userId: user.id });
      await setToken(data.token);
      showToast("success", `Dev login as ${user.name}`);
      navigate(ROUTES.ROOT);
    } catch (error) {
      showToast("error", apiErrorMessage(error, "Dev login failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ width: "90%", borderWidth: 2, borderStyle: "dashed", borderColor: "red", padding: 8, gap: 6 }}>
      <CustomText style={{ fontFamily: "VendSansBold", color: "red", fontSize: 14 }}>DEV LOGIN · seeded test users</CustomText>
      <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
        {users.map((u) => (
          <TouchableOpacity
            key={u.id}
            disabled={!!busy}
            onPress={() => signIn(u)}
            style={{
              borderWidth: 2,
              borderColor: c.primary,
              backgroundColor: u.suspended ? "#ddd" : c.secondary,
              paddingHorizontal: 10,
              paddingVertical: 4,
              opacity: busy && busy !== u.id ? 0.5 : 1,
            }}
          >
            <CustomText style={{ fontSize: 14 }}>
              {countryFlag(u.country)} {u.name}
              {u.suspended ? " (suspended)" : ""}
            </CustomText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default DevLogin;
