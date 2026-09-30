import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

/**
 * Importing expo-notifications throws on Android inside Expo Go.
 *
 * Its DevicePushTokenAutoRegistration side-effect module registers a device
 * push token listener while the module evaluates, and as of SDK 57 that
 * listener throws in Expo Go rather than logging — Expo Go dropped remote
 * notifications back in SDK 53. An import-time throw takes down every module
 * that transitively imports this one, so the require stays lazy and guarded.
 */
const pushAvailable = !(isRunningInExpoGo() && Platform.OS === "android");

type NotificationsModule = typeof import("expo-notifications");

let notificationsModule: NotificationsModule | undefined;

/** Loads expo-notifications, or returns null where it cannot be imported. */
function loadNotifications(): NotificationsModule | null {
  if (!pushAvailable) return null;

  if (!notificationsModule) {
    notificationsModule = require("expo-notifications") as NotificationsModule;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  return notificationsModule;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Padrão",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return token;
}

const DEVICE_ID_KEY = "@tatame/device-id";

export async function getDeviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;

  const id = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}
