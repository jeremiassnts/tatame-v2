import Constants from "expo-constants";
import { Platform } from "react-native";

const isExpoGo = Constants.appOwnership === "expo";

type PurchasesModule = typeof import("react-native-purchases").default;
type LogLevelModule = typeof import("react-native-purchases").LOG_LEVEL;

let Purchases: PurchasesModule | null = null;
let LOG_LEVEL: LogLevelModule | null = null;

if (!isExpoGo) {
  const mod = require("react-native-purchases");
  Purchases = mod.default;
  LOG_LEVEL = mod.LOG_LEVEL;
}

let initialized = false;
let currentUserId: string | null = null;

export function initRevenueCat(): void {
  if (isExpoGo || !Purchases || !LOG_LEVEL) return;
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
  if (!initialized || !Purchases) return;
  if (currentUserId === userId) return;
  await Purchases.logIn(userId);
  currentUserId = userId;
}

export async function resetRevenueCatUser(): Promise<void> {
  if (!initialized || !Purchases || !currentUserId) return;
  await Purchases.logOut();
  currentUserId = null;
}
