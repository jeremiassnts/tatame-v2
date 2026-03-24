# Mobile Base + Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Expo mobile app and implement the two onboarding screens (Welcome + User Type Selection).

**Architecture:** Expo managed workflow with file-based routing (Expo Router). NativeWind v4 for Tailwind-based styling. Single font family (Poppins). Onboarding is a two-screen stack: Welcome → User Type Selection, with role persisted to AsyncStorage.

**Tech Stack:** Expo SDK 52, Expo Router, NativeWind v4, Poppins (expo-font), lucide-react-native, expo-linear-gradient, AsyncStorage

**Spec:** `docs/superpowers/specs/2026-03-24-mobile-base-onboarding-design.md`

**React Native skills:** `.agents/skills/vercel-react-native-skills/SKILL.md` — reference for RN best practices

---

## File Structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx                 # Root layout: font loading, NativeWind
│   ├── (onboarding)/
│   │   ├── _layout.tsx             # Stack, headerless
│   │   ├── index.tsx               # Welcome screen
│   │   └── user-type.tsx           # User Type Selection screen
│   ├── (auth)/
│   │   └── _layout.tsx             # Placeholder
│   └── (app)/
│       └── _layout.tsx             # Placeholder
├── components/
│   └── GradientButton.tsx          # Reusable purple gradient CTA
├── constants/
│   └── tokens.ts                   # Color + spacing tokens (non-Tailwind uses)
├── assets/
│   └── images/                     # User-provided logo (already created)
├── global.css                      # Tailwind base imports
├── tailwind.config.js              # Custom theme with design tokens
├── nativewind-env.d.ts             # NativeWind TS types
├── metro.config.js                 # NativeWind metro integration
├── babel.config.js                 # NativeWind babel preset
├── app.json                        # Expo config
├── tsconfig.json                   # Extends base, Expo paths
└── package.json                    # Dependencies
```

---

### Task 1: Scaffold Expo app with dependencies

**Files:**
- Rewrite: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/global.css`
- Create: `apps/mobile/tailwind.config.js`
- Create: `apps/mobile/nativewind-env.d.ts`

- [ ] **Step 1: Write `package.json` with all dependencies**

```json
{
  "name": "@tatame/mobile",
  "version": "0.0.0",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "build": "echo 'mobile: use EAS Build'",
    "lint": "echo 'no lint configured'"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-font": "~13.0.0",
    "expo-splash-screen": "~0.29.0",
    "expo-status-bar": "~2.0.0",
    "expo-linear-gradient": "~14.0.0",
    "@expo-google-fonts/poppins": "^0.2.3",
    "@react-native-async-storage/async-storage": "1.23.1",
    "lucide-react-native": "^0.468.0",
    "react-native-svg": "15.8.0",
    "nativewind": "^4.1.23",
    "react": "18.3.1",
    "react-native": "0.76.6",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.20.2"
  },
  "devDependencies": {
    "@types/react": "~18.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.3"
  }
}
```

- [ ] **Step 2: Write `app.json`**

```json
{
  "expo": {
    "name": "Tatame",
    "slug": "tatame",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "tatame",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.tatame.app"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#0C0C0C"
      },
      "package": "com.tatame.app"
    },
    "plugins": [
      "expo-router",
      "expo-font"
    ]
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "nativewind-env.d.ts"
  ]
}
```

- [ ] **Step 4: Write `babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
  };
};
```

- [ ] **Step 5: Write `metro.config.js`**

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 6: Write `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 7: Write `tailwind.config.js` with design tokens**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        poppins: ["Poppins_400Regular"],
        "poppins-medium": ["Poppins_500Medium"],
        "poppins-semibold": ["Poppins_600SemiBold"],
        "poppins-bold": ["Poppins_700Bold"],
      },
      colors: {
        background: "#0C0C0C",
        surface: "#1A1A1A",
        "surface-border": "#2A2A2A",
        accent: "#A078E8",
        "accent-dark": "#7C5CBF",
        "accent-translucent": "rgba(160,120,232,0.125)",
        primary: "#FFFFFF",
        muted: "#ABABAB",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 8: Write `nativewind-env.d.ts`**

```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 9: Write `constants/tokens.ts`**

```ts
export const colors = {
  background: "#0C0C0C",
  surface: "#1A1A1A",
  surfaceBorder: "#2A2A2A",
  accent: "#A078E8",
  accentDark: "#7C5CBF",
  primary: "#FFFFFF",
  muted: "#ABABAB",
} as const;
```

- [ ] **Step 10: Install dependencies**

Run from repo root:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm install
```
Expected: packages installed, lockfile updated, no errors.

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/
git commit -m "feat(mobile): scaffold Expo app with NativeWind and design tokens"
```

---

### Task 2: Root layout with font loading

**Files:**
- Create: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Write root layout**

```tsx
import "../global.css";

import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Slot />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Verify app loads**

Run from `apps/mobile`:
```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx expo start
```
Expected: Expo starts, no crash. Blank screen is fine — no routes yet.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add root layout with Poppins font loading"
```

---

### Task 3: Onboarding layout + placeholder routes

**Files:**
- Create: `apps/mobile/app/(onboarding)/_layout.tsx`
- Create: `apps/mobile/app/(onboarding)/index.tsx` (placeholder)
- Create: `apps/mobile/app/(onboarding)/user-type.tsx` (placeholder)
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(app)/_layout.tsx`

- [ ] **Step 1: Write onboarding layout (headerless stack)**

```tsx
import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0C0C0C" },
        animation: "slide_from_right",
      }}
    />
  );
}
```

- [ ] **Step 2: Write Welcome placeholder**

```tsx
import { View, Text } from "react-native";

export default function WelcomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="font-poppins-bold text-2xl text-primary">Welcome placeholder</Text>
    </View>
  );
}
```

- [ ] **Step 3: Write User Type placeholder**

```tsx
import { View, Text } from "react-native";

export default function UserTypeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="font-poppins-bold text-2xl text-primary">User Type placeholder</Text>
    </View>
  );
}
```

- [ ] **Step 4: Write auth placeholder layout**

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```

- [ ] **Step 5: Write app placeholder layout**

```tsx
import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```

- [ ] **Step 6: Verify navigation works**

Run Expo, confirm:
- App boots to Welcome placeholder
- NativeWind classes render (dark background, white text, Poppins font)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/
git commit -m "feat(mobile): add onboarding/auth/app route groups with placeholders"
```

---

### Task 4: GradientButton component

**Files:**
- Create: `apps/mobile/components/GradientButton.tsx`

- [ ] **Step 1: Write GradientButton**

```tsx
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";

type GradientButtonProps = {
  label: string;
  onPress: () => void;
};

export function GradientButton({ label, onPress }: GradientButtonProps) {
  return (
    <Pressable onPress={onPress} className="w-full">
      <LinearGradient
        colors={["#A078E8", "#7C5CBF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="h-14 flex-row items-center justify-center rounded-xl"
      >
        <Text className="font-poppins-semibold text-base text-white">
          {label}
        </Text>
        <ArrowRight size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
      </LinearGradient>
    </Pressable>
  );
}
```

- [ ] **Step 2: Verify visually**

Import into Welcome placeholder temporarily, check gradient renders correctly on device.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/GradientButton.tsx
git commit -m "feat(mobile): add GradientButton component with purple gradient"
```

---

### Task 5: Welcome screen (M-ONBOARD-01)

**Files:**
- Modify: `apps/mobile/app/(onboarding)/index.tsx`

**Design reference:** Frame `LHmll` in `design.pen` — dark bg, centered logo placeholder (120x120, rounded-3xl, #242424), "TATAME" title (Poppins 700, 38px), tagline (Poppins 400, 16px, muted), CTA button at bottom.

- [ ] **Step 1: Implement Welcome screen**

```tsx
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { GradientButton } from "@/components/GradientButton";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      {/* Content — centered */}
      <View className="flex-1 items-center justify-center px-10">
        {/* Logo placeholder */}
        <View className="h-[120px] w-[120px] items-center justify-center rounded-3xl bg-[#242424]">
          {/* User will replace with Image component for their logo */}
        </View>

        <View className="mt-8 items-center gap-3">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 38, letterSpacing: -1.5 }}
          >
            TATAME
          </Text>
          <Text className="font-poppins text-center text-base leading-6 text-muted">
            Gerencie sua academia de Jiu-Jitsu com simplicidade e eficiência
          </Text>
        </View>
      </View>

      {/* Bottom CTA */}
      <View className="px-6 pb-6">
        <GradientButton
          label="Continuar"
          onPress={() => router.push("/(onboarding)/user-type")}
        />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify on device**

Compare with design screenshot (frame `LHmll`). Check:
- Dark background fills screen
- Logo placeholder centered with correct size and rounding
- "TATAME" text is large, bold, tight letter-spacing
- Tagline centered, muted color
- CTA at bottom with gradient, arrow icon
- Tapping CTA navigates to user-type

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(onboarding\)/index.tsx
git commit -m "feat(mobile): implement Welcome screen (M-ONBOARD-01)"
```

---

### Task 6: User Type Selection screen (M-ONBOARD-02)

**Files:**
- Modify: `apps/mobile/app/(onboarding)/user-type.tsx`

**Design reference:** Frame `C0GXO` in `design.pen` — title/subtitle at top, 3 selectable role cards (Gestor/Instrutor/Aluno), selected state with purple border + translucent bg, CTA at bottom. Saves to AsyncStorage.

- [ ] **Step 1: Implement User Type Selection screen**

```tsx
import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Building2, GraduationCap, User } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GradientButton } from "@/components/GradientButton";

const ROLES = [
  {
    key: "manager" as const,
    label: "Gestor",
    description: "Crie e gerencie sua academia, alunos e instrutores",
    Icon: Building2,
  },
  {
    key: "instructor" as const,
    label: "Instrutor",
    description: "Ensine aulas e acompanhe o progresso dos alunos",
    Icon: GraduationCap,
  },
  {
    key: "student" as const,
    label: "Aluno",
    description: "Treine, registre presença e acompanhe sua graduação",
    Icon: User,
  },
] as const;

type UserType = (typeof ROLES)[number]["key"];

export default function UserTypeScreen() {
  const [selected, setSelected] = useState<UserType>("manager");

  const handleContinue = async () => {
    await AsyncStorage.setItem("userType", selected);
    // TODO: navigate to auth flow once implemented
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-8 p-6 pt-4">
        {/* Header */}
        <View className="gap-2">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}
          >
            Qual é o seu perfil?
          </Text>
          <Text className="font-poppins text-[15px] leading-5 text-muted">
            Selecione o que melhor descreve você para personalizar sua
            experiência.
          </Text>
        </View>

        {/* Role Cards */}
        <View className="gap-3">
          {ROLES.map(({ key, label, description, Icon }) => {
            const isSelected = selected === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(key)}
                className={`flex-row items-center gap-4 rounded-2xl p-5 ${
                  isSelected
                    ? "border-[1.5px] border-accent bg-accent-translucent"
                    : "border border-surface-border bg-surface"
                }`}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={["#A078E8", "#7C5CBF"]}
                    className="h-12 w-12 items-center justify-center rounded-xl"
                  >
                    <Icon size={24} color="#FFFFFF" />
                  </LinearGradient>
                ) : (
                  <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#242424]">
                    <Icon size={24} color="#ABABAB" />
                  </View>
                )}
                <View className="flex-1 gap-1">
                  <Text className="font-poppins-semibold text-base text-primary">
                    {label}
                  </Text>
                  <Text className="font-poppins text-[13px] leading-4 text-muted">
                    {description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* CTA */}
        <GradientButton label="Continuar" onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify on device**

Compare with design screenshot (frame `C0GXO`). Check:
- Title and subtitle match design
- 3 cards render with correct icons (Building2, GraduationCap, User)
- Default: "Gestor" selected (purple border + translucent bg + gradient icon)
- Tap other card: selection updates visually
- CTA at bottom
- Tapping CTA saves to AsyncStorage (verify with `adb shell` or React Native debugger)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(onboarding\)/user-type.tsx
git commit -m "feat(mobile): implement User Type Selection screen (M-ONBOARD-02)"
```

---

### Task 7: Final verification and cleanup

- [ ] **Step 1: Full flow test on device**

1. Kill app, relaunch
2. Welcome screen loads with Poppins font, dark theme, logo placeholder, CTA
3. Tap "Continuar" → navigates to User Type Selection
4. Cards are selectable, visual state changes
5. Select "Aluno", tap "Continuar"
6. Verify AsyncStorage has `userType=student`

- [ ] **Step 2: Verify `pnpm build` from root**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm build
```
Expected: no errors (mobile build script is a no-op placeholder for EAS).

- [ ] **Step 3: Final commit if any tweaks**

```bash
git add -A apps/mobile/
git commit -m "fix(mobile): polish onboarding screens after device testing"
```
