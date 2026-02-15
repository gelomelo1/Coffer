import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect } from "react";
import { LoadingScreen } from "../components/custom_ui/loading";
import { endpoints } from "../const/endpoints";
import { pageParams, ROUTES } from "../const/navigation_params";
import { useResetNavigation } from "../hooks/navigation";
import { useUserStore } from "../hooks/user_store";
import User from "../types/entities/user";
import { getSingleData } from "../utils/backend_access";

export default function Index() {
  const resetNavigate = useResetNavigation();
  const { setUser } = useUserStore();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem("jwt");
      if (!token) {
        navigate(ROUTES.LOGIN);
      } else {
        try {
          const currentUser = await getSingleData<User>(
            endpoints.currentUser,
            undefined,
            { Authorization: `Bearer ${token}` },
          );
          setUser(currentUser);
          resetNavigate({
            pathname: ROUTES.COLLECTIONS.ROOT,
            params: pageParams.collections,
          });
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
            if (
              error.response?.status === 401 ||
              error.response?.status === 404
            ) {
              navigate(ROUTES.LOGIN);
            }
          }
        }
      }
    };
    checkAuth();
  }, []);

  return <LoadingScreen label="Trying to log you in..." />;
}
