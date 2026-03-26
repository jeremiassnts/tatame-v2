import { useSSO } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import { useAuthComplete } from "./use-auth-complete";

export function useStartSSO() {
  const { startSSOFlow } = useSSO();
  const { completeAuth, loading } = useAuthComplete();

  const redirectUrl = Linking.createURL("/sso-callback");

  const handleSSO = async (strategy: "oauth_google" | "oauth_apple") => {
    try {
      const result = await startSSOFlow({
        strategy,
        redirectUrl,
      });
      await completeAuth({
        createdSessionId: result.createdSessionId,
        setActive: result.setActive,
      });
    } catch {
      // user cancelled or provider error
    }
  };

  return { handleSSO, loading };
}
