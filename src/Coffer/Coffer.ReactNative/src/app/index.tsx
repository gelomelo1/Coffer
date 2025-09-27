import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { LoadingScreen } from "../components/custom_ui/loading";
import { endpoints } from "../const/endpoints";
import User from "../types/entities/user";
import { getDataById } from "../utils/backend_access";

export default function Index() {
  const [initialRoute, setInitialRoute] = useState<
    "/login" | `/collections?${string}` | null
  >(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem("jwt");
      if (!token) {
        setInitialRoute("/login");
      } else {
        try {
          const currentUser = await getDataById<User>(
            endpoints.currentUser,
            undefined,
            { Authorization: `Bearer ${token}` }
          );
          setInitialRoute(
            `/collections?user=${encodeURIComponent(
              JSON.stringify(currentUser)
            )}`
          );
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
            if (
              error.response?.status === 401 ||
              error.response?.status === 404
            ) {
              setInitialRoute("/login");
            }
          }
        }
      }
    };
    checkAuth();
  }, []);

  if (!initialRoute) return <LoadingScreen label="Trying to log you in..." />;

  return <Redirect href={initialRoute} />;
}
