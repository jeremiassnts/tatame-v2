import { useState } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { syncUser } from "@/lib/api";

type SetActiveFn = (params: { session: string | null }) => Promise<void>;

type CompleteAuthParams = {
  createdSessionId: string | null;
  setActive: SetActiveFn | undefined;
};

export function useAuthComplete() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const completeAuth = async ({ createdSessionId, setActive }: CompleteAuthParams) => {
    if (!createdSessionId || !setActive) return;
    setLoading(true);
    try {
      await setActive({ session: createdSessionId });
      const token = await getToken();
      if (!token) {
        throw new Error("Sessão inválida. Tente novamente.");
      }
      const userType = await AsyncStorage.getItem("userType");
      await syncUser(token, userType);
      router.replace("/(app)");
    } finally {
      setLoading(false);
    }
  };

  return { completeAuth, loading };
}
