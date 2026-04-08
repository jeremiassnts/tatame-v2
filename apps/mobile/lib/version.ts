import Constants from "expo-constants";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/v1";

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

export async function shouldForceUpdate(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/version`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;

    const data: { minMobileVersion?: string } = await res.json();
    const minVersion = data.minMobileVersion ?? "";
    if (!minVersion) return false;

    const currentVersion = Constants.expoConfig?.version ?? "0.0.0";
    return isVersionLessThan(currentVersion, minVersion);
  } catch {
    return false;
  }
}
