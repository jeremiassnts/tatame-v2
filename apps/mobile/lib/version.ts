import Constants from "expo-constants";

function parseVersion(version: string): number[] {
  return version
    .split(".")
    .map((part) => Number(part))
    .map((num) => (Number.isFinite(num) ? num : 0));
}

export function isVersionLessThan(current: string, minimum: string): boolean {
  const currentParts = parseVersion(current);
  const minimumParts = parseVersion(minimum);
  const maxLength = Math.max(currentParts.length, minimumParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const currentPart = currentParts[i] ?? 0;
    const minimumPart = minimumParts[i] ?? 0;
    if (currentPart < minimumPart) return true;
    if (currentPart > minimumPart) return false;
  }

  return false;
}

export function shouldForceUpdate(): boolean {
  const minVersion =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.EXPO_PUBLIC_MIN_APP_VERSION ?? "";
  if (!minVersion) return false;

  const currentVersion = Constants.expoConfig?.version ?? "0.0.0";
  return isVersionLessThan(currentVersion, minVersion);
}
