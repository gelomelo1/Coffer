import { Href, useRouter } from "expo-router";
import { useCallback } from "react";

export const useResetNavigation = () => {
  const router = useRouter();

  const navigate = useCallback((route: Href) => {
    if (router.canDismiss()) router.dismissAll();
    router.replace(route);
  }, []);

  return navigate;
};
