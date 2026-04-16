import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

let initialized = false;
let currentUserId: string | null = null;

export function initRevenueCat(): void {
  if (initialized) return;

  const apiKey =
    Platform.OS === "ios"
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.warn("[revenuecat] missing API key for", Platform.OS);
    return;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
  initialized = true;
}

export async function identifyRevenueCatUser(userId: string): Promise<void> {
  if (!initialized) return;
  if (currentUserId === userId) return;
  await Purchases.logIn(userId);
  currentUserId = userId;
}

export async function resetRevenueCatUser(): Promise<void> {
  if (!initialized) return;
  await Purchases.logOut();
  currentUserId = null;
}
