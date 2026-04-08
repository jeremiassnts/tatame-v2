# Remote Force-Update Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static build-time version check with a runtime fetch to the API so old app versions can learn about new minimum version requirements.

**Architecture:** Mobile app fetches `GET /v1/version` (no auth) on startup, compares `minMobileVersion` from response against the app's built-in version. On failure, app opens normally.

**Tech Stack:** React Native (Expo), TypeScript, plain fetch

---

### Task 1: Update `shouldForceUpdate()` to fetch from API

**Files:**
- Modify: `apps/mobile/lib/version.ts`

- [ ] **Step 1: Rewrite `shouldForceUpdate` as async with remote fetch**

Replace the entire `shouldForceUpdate` function. Keep `parseVersion` and `isVersionLessThan` unchanged.

```typescript
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/mobile && npx tsc --noEmit lib/version.ts 2>&1 || echo 'Check errors above'`

Expected: No errors (or only unrelated ambient type warnings).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/version.ts
git commit -m "feat(mobile): fetch min version from API instead of build-time env"
```

---

### Task 2: Update `index.tsx` to handle async version check

**Files:**
- Modify: `apps/mobile/app/index.tsx`

- [ ] **Step 1: Rewrite Index to call async `shouldForceUpdate`**

```typescript
import { shouldForceUpdate } from "@/lib/version";
import { useAuth } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const [userType, setUserType] = useState<string | null | undefined>(
    undefined
  );
  const [needsUpdate, setNeedsUpdate] = useState<boolean | undefined>(
    undefined
  );

  useEffect(() => {
    AsyncStorage.getItem("userType").then(setUserType);
    shouldForceUpdate().then(setNeedsUpdate);
  }, []);

  if (!isLoaded || userType === undefined || needsUpdate === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  if (needsUpdate) return <Redirect href="/(system)/force-update" />;
  if (!userType) return <Redirect href="/(onboarding)" />;
  if (!isSignedIn) return <Redirect href="/(auth)" />;
  return <Redirect href="/(app)" />;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/mobile && npx tsc --noEmit app/index.tsx 2>&1 || echo 'Check errors above'`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/index.tsx
git commit -m "feat(mobile): use async version check on app startup"
```

---

### Task 3: Clean up force-update screen

**Files:**
- Modify: `apps/mobile/app/(system)/force-update.tsx`

- [ ] **Step 1: Remove `EXPO_PUBLIC_MIN_APP_VERSION` reference, show only current version**

```typescript
import Constants from "expo-constants";
import { Download, ExternalLink } from "lucide-react-native";
import { Alert, Linking, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function getStoreUrl() {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_IOS_STORE_URL ?? "";
  }
  return process.env.EXPO_PUBLIC_ANDROID_STORE_URL ?? "";
}

export default function ForceUpdateScreen() {
  const currentVersion = Constants.expoConfig?.version ?? "1.0.0";

  const handleUpdateNow = async () => {
    const storeUrl = getStoreUrl();
    if (!storeUrl) {
      Alert.alert("Atualização pendente", "Link da loja ainda não configurado.");
      return;
    }

    const canOpen = await Linking.canOpenURL(storeUrl);
    if (!canOpen) {
      Alert.alert("Erro", "Não foi possível abrir o link da loja.");
      return;
    }

    await Linking.openURL(storeUrl);
  };

  return (
    <SafeAreaView className="flex-1 bg-background pt-4">
      <View className="flex-1 bg-background">
        <View className="h-[62px] px-6" />

        <View className="flex-1 items-center justify-center gap-8 px-10">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-accent-translucent">
            <Download size={40} color="#A078E8" />
          </View>

          <View className="w-full items-center gap-3">
            <Text
              className="font-poppins-bold text-center text-primary"
              style={{ fontSize: 32, letterSpacing: -1 }}
            >
              Atualização disponível
            </Text>
            <Text className="font-poppins text-center text-[15px] leading-6 text-muted">
              Uma nova versão do Tatame está disponível. Atualize o app para continuar
              usando.
            </Text>
          </View>

          <View className="rounded-[20px] border border-surface-border bg-surface px-4 py-2">
            <Text className="font-poppins-medium text-[13px] text-muted">
              Versão atual: v{currentVersion}
            </Text>
          </View>
        </View>

        <View className="gap-4 px-6 pb-12">
          <Pressable
            onPress={handleUpdateNow}
            className="h-14 flex-row items-center justify-center gap-2 rounded-xl bg-accent"
          >
            <ExternalLink size={20} color="#FFFFFF" />
            <Text className="font-poppins-semibold text-base text-white">Atualizar agora</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

Changes from original:
- Removed `ArrowRight` import (no longer needed)
- Removed `EXPO_PUBLIC_MIN_APP_VERSION` reading
- Simplified version badge to show only "Versão atual: v{currentVersion}" instead of the arrow between versions

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(system\)/force-update.tsx
git commit -m "fix(mobile): remove static env var from force-update screen"
```
