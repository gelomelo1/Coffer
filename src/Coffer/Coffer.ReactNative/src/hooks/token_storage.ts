import { useEffect, useState } from "react";
import { getAccessToken } from "../utils/token_store";

function useTokenStorage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await getAccessToken();
        setToken(storedToken);
        setIsLoaded(true);
      } catch {
        setIsError(true);
        console.error("Secure token storage unavailable");
      }
    };
    loadToken();
  }, []);

  return { isLoaded, isError, token };
}

export default useTokenStorage;
