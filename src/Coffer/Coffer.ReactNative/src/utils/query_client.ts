import { QueryClient } from "@tanstack/react-query";

/** The app's one React Query cache. Signing out clears it, so the next account never sees the previous one's data. */
export const queryClient = new QueryClient();
