import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { asyncstoragekeys } from "../const/async_storage_keys";

function useTokenStorage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(asyncstoragekeys.jwt);
        setToken(storedToken);
        setIsLoaded(true);
      } catch (error) {
        setIsError(true);
        console.error("Error loading token from AsyncStorage:", error);
      }
    };
    loadToken();
  }, []);

  return { isLoaded, isError, token };
}

export default useTokenStorage;
