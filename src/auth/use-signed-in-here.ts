import { useAuthToken } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function useSignedInHere() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const savedToken = useAuthToken() !== null;
  return {
    signedIn: isAuthenticated || (isLoading && savedToken),
    settling: isLoading && !savedToken,
  };
}
