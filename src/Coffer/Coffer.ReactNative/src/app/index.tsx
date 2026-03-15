import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect } from "react";
import { LoadingScreen } from "../components/custom_ui/loading";
import { asyncstoragekeys } from "../const/async_storage_keys";
import { endpoints } from "../const/endpoints";
import { pageParams, ROUTES } from "../const/navigation_params";
import { useCollectionTypeStore } from "../hooks/collection_type_store";
import { useResetNavigation } from "../hooks/navigation";
import { useUserStore } from "../hooks/user_store";
import CollectionType from "../types/entities/collectiontype";
import User from "../types/entities/user";
import { getData, getSingleData } from "../utils/backend_access";

export default function Index() {
  const resetNavigate = useResetNavigation();
  const { setUser } = useUserStore();
  const { setCollectionTypes } = useCollectionTypeStore();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem(asyncstoragekeys.jwt);
      if (!token) {
        navigate(ROUTES.LOGIN);
      } else {
        console.log(token);
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
            }
          }
        }
      }
    };
    checkAuth();
  }, []);

  return <LoadingScreen label="Trying to log you in..." />;
}
