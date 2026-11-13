import { useEffect, useState } from "react";
import { getToken } from "../utils/token_store";

function useTokenStorage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await getToken();
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
