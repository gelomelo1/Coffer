import axios from "axios";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ErrorState } from "../components/custom_ui/states";
import { colors } from "../theme/theme";
import { apiErrorText } from "../utils/api_error_text";
import { LoadingScreen } from "../components/custom_ui/loading";
import { endpoints } from "../const/endpoints";
import { pageParams, ROUTES } from "../const/navigation_params";
import { useCollectionTypeStore } from "../hooks/collection_type_store";
import { useConnectionStore } from "../hooks/connection_store";
import { useResetNavigation } from "../hooks/navigation";
import { useSuspensionStore } from "../hooks/suspension_store";
import { useUserStore } from "../hooks/user_store";
import CollectionType from "../types/entities/collectiontype";
import User from "../types/entities/user";
import { getData, getSingleData } from "../utils/backend_access";
import { getAccessToken } from "../utils/token_store";

export default function Index() {
  const resetNavigate = useResetNavigation();
  const { setUser } = useUserStore();
  const { setCollectionTypes } = useCollectionTypeStore();
  // While suspended the SuspendedScreen covers the app; once "Check again" clears it, sign-in is retried.
  const suspension = useSuspensionStore((s) => s.suspension);
  // Same while a connection page (no internet / Coffer unavailable) is open: it closes once the connection works, and
  // sign-in is retried then (this check is a plain request, so the query refetch after reconnecting doesn't reach it).
  const connectionProblem = useConnectionStore((s) => s.problem);
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (suspension || connectionProblem) return;
    const checkAuth = async () => {
      const token = await getAccessToken();
      if (!token) {
        navigate(ROUTES.LOGIN);
      } else {
        try {
          const currentUser = await getSingleData<User>(
            endpoints.currentUser,
            undefined,
            { Authorization: `Bearer ${token}` },
          );
          const collectionTypes = await getData<CollectionType>(
            endpoints.collectionTypes,
            { Authorization: `Bearer ${token}` },
          );
          setUser(currentUser);
          setCollectionTypes(collectionTypes);
          resetNavigate({
            pathname: ROUTES.TABS.HOME,
            params: pageParams.home,
          });
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
            if (
              error.response?.status === 401 ||
              error.response?.status === 404
            ) {
              navigate(ROUTES.LOGIN);
              return;
            }
          }
          // Server unreachable / failing: say so and offer a retry instead of spinning forever.
          setError(apiErrorText(error));
        }
      }
    };
    setError(null);
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspension, connectionProblem, attempt]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}>
        <ErrorState message={error} onRetry={() => setAttempt((a) => a + 1)} />
      </View>
    );
  }

  return <LoadingScreen label={t("auth:signingIn")} />;
}
