# Auth Screens + Clerk Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 auth screens with Clerk custom flow integration for email/password and OAuth (Google/Apple).

**Architecture:** Clerk custom flows with `useSignUp`, `useSignIn`, `useOAuth` hooks. Token cache via expo-secure-store. Root layout wraps app in ClerkProvider. Root index redirects based on onboarding + auth state. Shared components (FormInput, SocialButtons, BackButton, Divider) extracted for reuse across auth screens.

**Tech Stack:** @clerk/clerk-expo, expo-secure-store, expo-web-browser, Expo Router, NativeWind v4, lucide-react-native

**Spec:** `docs/superpowers/specs/2026-03-24-auth-screens-clerk-design.md`

---

## File Structure

```
apps/mobile/
├── lib/
│   └── clerk-token-cache.ts       # expo-secure-store adapter for Clerk
├── components/
│   ├── BackButton.tsx              # Back nav button (dark, arrow-left)
│   ├── Divider.tsx                 # Line + text + line separator
│   ├── FormInput.tsx               # Labeled input with error state
│   ├── SocialButtons.tsx           # Google + Apple OAuth side by side
│   └── GradientButton.tsx          # (existing)
├── app/
│   ├── _layout.tsx                 # MODIFY: add ClerkProvider
│   ├── index.tsx                   # MODIFY: smart redirect (onboarding/auth/app)
│   ├── (onboarding)/
│   │   └── user-type.tsx           # MODIFY: navigate to /(auth) after selection
│   ├── (auth)/
│   │   ├── _layout.tsx             # MODIFY: Stack with contentStyle
│   │   ├── index.tsx               # AUTH-01: Welcome Landing
│   │   ├── sign-up.tsx             # AUTH-02: Sign Up
│   │   ├── sign-in.tsx             # AUTH-03: Sign In
│   │   └── verify-email.tsx        # AUTH-04: Email Verification
│   └── (app)/
│       └── _layout.tsx             # (existing placeholder)
└── .env                            # EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
```

---

### Task 1: Install Clerk dependencies

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install packages**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx expo install @clerk/clerk-expo expo-secure-store expo-web-browser
```

- [ ] **Step 2: Create `.env` file**

Create `apps/mobile/.env`:
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
```

Add `.env` to `apps/mobile/.gitignore`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/.gitignore ../../pnpm-lock.yaml
git commit -m "chore(mobile): add Clerk, expo-secure-store, expo-web-browser"
```

---

### Task 2: Clerk token cache + ClerkProvider in root layout

**Files:**
- Create: `apps/mobile/lib/clerk-token-cache.ts`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Write token cache adapter**

```ts
// apps/mobile/lib/clerk-token-cache.ts
import * as SecureStore from "expo-secure-store";
import { TokenCache } from "@clerk/clerk-expo";

export const tokenCache: TokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    await SecureStore.setItemAsync(key, value);
  },
  async clearToken(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
};
```

- [ ] **Step 2: Update root layout with ClerkProvider**

Replace `apps/mobile/app/_layout.tsx` with:

```tsx
import "../global.css";

import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { tokenCache } from "@/lib/clerk-token-cache";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

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
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Slot />
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3: Verify app boots**

Run `npx expo start --clear`. App should load without crash (Clerk key is placeholder but won't crash until auth is attempted).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/clerk-token-cache.ts apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add ClerkProvider with secure-store token cache"
```

---

### Task 3: Smart root redirect

**Files:**
- Modify: `apps/mobile/app/index.tsx`
- Modify: `apps/mobile/app/(onboarding)/user-type.tsx`

- [ ] **Step 1: Update root index with auth-aware redirect**

```tsx
// apps/mobile/app/index.tsx
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const [userType, setUserType] = useState<string | null | undefined>(
    undefined
  );

  useEffect(() => {
    AsyncStorage.getItem("userType").then(setUserType);
  }, []);

  if (!isLoaded || userType === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#A078E8" />
      </View>
    );
  }

  if (!userType) return <Redirect href="/(onboarding)" />;
  if (!isSignedIn) return <Redirect href="/(auth)" />;
  return <Redirect href="/(app)" />;
}
```

- [ ] **Step 2: Update user-type to navigate to auth after selection**

In `apps/mobile/app/(onboarding)/user-type.tsx`, replace the `handleContinue` function:

```tsx
import { useRouter } from "expo-router";
// ... (add to existing imports)

// Inside component, add:
const router = useRouter();

const handleContinue = async () => {
  await AsyncStorage.setItem("userType", selected);
  router.replace("/(auth)");
};
```

- [ ] **Step 3: Verify flow**

1. Clear AsyncStorage (fresh install or clear app data)
2. App → onboarding → select role → "Continuar" → should land on auth welcome landing (will be placeholder for now)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/index.tsx "apps/mobile/app/(onboarding)/user-type.tsx"
git commit -m "feat(mobile): smart root redirect and onboarding-to-auth transition"
```

---

### Task 4: Shared components (BackButton, Divider, FormInput, SocialButtons)

**Files:**
- Create: `apps/mobile/components/BackButton.tsx`
- Create: `apps/mobile/components/Divider.tsx`
- Create: `apps/mobile/components/FormInput.tsx`
- Create: `apps/mobile/components/SocialButtons.tsx`

- [ ] **Step 1: Write BackButton**

```tsx
// apps/mobile/components/BackButton.tsx
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

type BackButtonProps = {
  onPress?: () => void;
};

export function BackButton({ onPress }: BackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      className="h-10 w-10 items-center justify-center rounded-xl border border-surface-border bg-surface"
    >
      <ArrowLeft size={20} color="#FFFFFF" />
    </Pressable>
  );
}
```

- [ ] **Step 2: Write Divider**

```tsx
// apps/mobile/components/Divider.tsx
import { View, Text } from "react-native";

type DividerProps = {
  text?: string;
};

export function Divider({ text = "ou" }: DividerProps) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View className="h-px flex-1 bg-[#2A2A2A]" />
      <Text className="font-poppins text-xs text-[#525252]">{text}</Text>
      <View className="h-px flex-1 bg-[#2A2A2A]" />
    </View>
  );
}
```

- [ ] **Step 3: Write FormInput**

```tsx
// apps/mobile/components/FormInput.tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, TextInputProps } from "react-native";
import { EyeOff, Eye } from "lucide-react-native";

type FormInputProps = {
  label: string;
  error?: string;
} & TextInputProps;

export function FormInput({
  label,
  error,
  secureTextEntry,
  ...props
}: FormInputProps) {
  const [hidden, setHidden] = useState(secureTextEntry);

  return (
    <View className="gap-1.5">
      <Text className="font-poppins-medium text-[13px] text-muted">
        {label}
      </Text>
      <View
        className={`h-[52px] flex-row items-center rounded-xl border bg-surface px-4 ${
          error ? "border-red-500" : "border-surface-border"
        }`}
      >
        <TextInput
          className="flex-1 font-poppins text-[15px] text-primary"
          placeholderTextColor="#525252"
          secureTextEntry={hidden}
          autoCorrect={false}
          {...props}
        />
        {secureTextEntry && (
          <Pressable onPress={() => setHidden((h) => !h)} className="ml-2">
            {hidden ? (
              <EyeOff size={20} color="#525252" />
            ) : (
              <Eye size={20} color="#525252" />
            )}
          </Pressable>
        )}
      </View>
      {error && (
        <Text className="font-poppins text-xs text-red-500">{error}</Text>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Write SocialButtons**

```tsx
// apps/mobile/components/SocialButtons.tsx
import { View, Text, Pressable } from "react-native";
import { Globe, Apple } from "lucide-react-native";

type SocialButtonsProps = {
  onGooglePress: () => void;
  onApplePress: () => void;
  disabled?: boolean;
};

export function SocialButtons({
  onGooglePress,
  onApplePress,
  disabled,
}: SocialButtonsProps) {
  return (
    <View className="flex-row gap-3">
      <Pressable
        onPress={onGooglePress}
        disabled={disabled}
        className="h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface"
      >
        <Globe size={20} color="#ABABAB" />
        <Text className="font-poppins-medium text-sm text-primary">
          Google
        </Text>
      </Pressable>
      <Pressable
        onPress={onApplePress}
        disabled={disabled}
        className="h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface"
      >
        <Apple size={20} color="#ABABAB" />
        <Text className="font-poppins-medium text-sm text-primary">Apple</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 5: Verify imports resolve**

Run `npx expo start --clear`, no bundler errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/BackButton.tsx apps/mobile/components/Divider.tsx apps/mobile/components/FormInput.tsx apps/mobile/components/SocialButtons.tsx
git commit -m "feat(mobile): add shared auth components (BackButton, Divider, FormInput, SocialButtons)"
```

---

### Task 5: Auth layout + Welcome Landing screen (AUTH-01)

**Files:**
- Modify: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(auth)/index.tsx`

- [ ] **Step 1: Update auth layout**

```tsx
// apps/mobile/app/(auth)/_layout.tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
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

- [ ] **Step 2: Implement Welcome Landing**

```tsx
// apps/mobile/app/(auth)/index.tsx
import { View, Text, Image, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { Divider } from "@/components/Divider";
import { SocialButtons } from "@/components/SocialButtons";

WebBrowser.maybeCompleteAuthSession();

export default function AuthWelcomeScreen() {
  const router = useRouter();
  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: "oauth_apple" });

  const handleOAuth = async (
    start: typeof startGoogle
  ) => {
    try {
      const { createdSessionId, setActive } = await start();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(app)");
      }
    } catch {
      // User cancelled or provider error — stay on screen
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      {/* Brand — centered */}
      <View className="flex-1 items-center justify-center px-10">
        <View className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[22px] bg-[#242424]">
          <Image
            source={require("@/assets/images/icon.png")}
            className="h-[60px] w-[60px]"
            resizeMode="contain"
          />
        </View>

        <View className="mt-6 items-center gap-2">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 32, letterSpacing: -1 }}
          >
            TATAME
          </Text>
          <Text className="font-poppins text-center text-[15px] text-muted">
            Sua academia na palma da mão
          </Text>
        </View>
      </View>

      {/* Bottom actions */}
      <View className="gap-4 px-6 pb-4">
        <Pressable
          onPress={() => router.push("/(auth)/sign-in")}
          className="h-14 items-center justify-center rounded-xl bg-accent"
        >
          <Text className="font-poppins-semibold text-base text-white">
            Entrar
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/sign-up")}
          className="h-14 items-center justify-center rounded-xl border border-[#3A3A3A] bg-surface"
        >
          <Text className="font-poppins-semibold text-base text-primary">
            Criar conta
          </Text>
        </Pressable>

        <Divider text="ou continue com" />

        <SocialButtons
          onGooglePress={() => handleOAuth(startGoogle)}
          onApplePress={() => handleOAuth(startApple)}
        />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify on device**

Compare with design screenshot (frame `sh9aY`). Check logo, buttons, social buttons, divider.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(auth)/_layout.tsx" "apps/mobile/app/(auth)/index.tsx"
git commit -m "feat(mobile): implement auth Welcome Landing screen (M-AUTH-01)"
```

---

### Task 6: Sign Up screen (AUTH-02)

**Files:**
- Create: `apps/mobile/app/(auth)/sign-up.tsx`

- [ ] **Step 1: Implement Sign Up**

```tsx
// apps/mobile/app/(auth)/sign-up.tsx
import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignUp, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { BackButton } from "@/components/BackButton";
import { FormInput } from "@/components/FormInput";
import { Divider } from "@/components/Divider";
import { SocialButtons } from "@/components/SocialButtons";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, setActive } = useSignUp();
  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: "oauth_apple" });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!signUp) return;
    setErrors({});
    setLoading(true);
    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName: name,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      router.push({
        pathname: "/(auth)/verify-email",
        params: { email },
      });
    } catch (err: any) {
      const clerkErrors = err?.errors;
      if (clerkErrors) {
        const mapped: Record<string, string> = {};
        for (const e of clerkErrors) {
          if (e.meta?.paramName === "email_address") mapped.email = e.longMessage;
          else if (e.meta?.paramName === "password") mapped.password = e.longMessage;
          else if (e.meta?.paramName === "first_name") mapped.name = e.longMessage;
          else mapped.general = e.longMessage;
        }
        setErrors(mapped);
      } else {
        Alert.alert("Erro", "Não foi possível criar a conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (start: typeof startGoogle) => {
    try {
      const result = await start();
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        router.replace("/(app)");
      }
    } catch {
      // cancelled
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-7 px-6 pt-2">
        <BackButton />

        <View className="gap-2">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}
          >
            Criar conta
          </Text>
          <Text className="font-poppins text-[15px] text-muted">
            Preencha seus dados para começar
          </Text>
        </View>

        <View className="gap-4">
          <FormInput
            label="Nome completo"
            placeholder="Digite seu nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            error={errors.name}
          />
          <FormInput
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <FormInput
            label="Senha"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />
        </View>

        {errors.general && (
          <Text className="font-poppins text-sm text-red-500">
            {errors.general}
          </Text>
        )}

        <View className="flex-1" />

        <View className="gap-4 pb-2">
          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            className="h-14 items-center justify-center rounded-xl bg-accent"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-base text-white">
                Criar conta
              </Text>
            )}
          </Pressable>

          <Divider />

          <SocialButtons
            onGooglePress={() => handleOAuth(startGoogle)}
            onApplePress={() => handleOAuth(startApple)}
            disabled={loading}
          />

          <View className="flex-row items-center justify-center gap-1 py-2">
            <Text className="font-poppins text-sm text-muted">
              Já tem uma conta?
            </Text>
            <Pressable onPress={() => router.replace("/(auth)/sign-in")}>
              <Text className="font-poppins-semibold text-sm text-accent">
                Entrar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify on device**

Compare with design (frame `6QNkX`). Check form fields, error states, loading spinner, social buttons, link.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(auth)/sign-up.tsx"
git commit -m "feat(mobile): implement Sign Up screen with Clerk custom flow (M-AUTH-02)"
```

---

### Task 7: Sign In screen (AUTH-03)

**Files:**
- Create: `apps/mobile/app/(auth)/sign-in.tsx`

- [ ] **Step 1: Implement Sign In**

```tsx
// apps/mobile/app/(auth)/sign-in.tsx
import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignIn, useOAuth } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { BackButton } from "@/components/BackButton";
import { FormInput } from "@/components/FormInput";
import { Divider } from "@/components/Divider";
import { SocialButtons } from "@/components/SocialButtons";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, setActive } = useSignIn();
  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: "oauth_apple" });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!signIn) return;
    setErrors({});
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });
      if (result.status === "complete" && setActive) {
        await setActive({ session: result.createdSessionId });
        router.replace("/(app)");
      }
    } catch (err: any) {
      const clerkErrors = err?.errors;
      if (clerkErrors) {
        const mapped: Record<string, string> = {};
        for (const e of clerkErrors) {
          if (
            e.code === "form_identifier_not_found" ||
            e.code === "form_password_incorrect"
          ) {
            mapped.general = "E-mail ou senha incorretos";
          } else {
            mapped.general = e.longMessage;
          }
        }
        setErrors(mapped);
      } else {
        Alert.alert("Erro", "Não foi possível entrar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (start: typeof startGoogle) => {
    try {
      const result = await start();
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        router.replace("/(app)");
      }
    } catch {
      // cancelled
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-7 px-6 pt-2">
        <BackButton />

        <View className="gap-2">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}
          >
            Bem-vindo de volta
          </Text>
          <Text className="font-poppins text-[15px] text-muted">
            Entre com sua conta para continuar
          </Text>
        </View>

        <View className="gap-4">
          <FormInput
            label="E-mail"
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <FormInput
            label="Senha"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />
          <View className="flex-row justify-end">
            <Pressable>
              <Text className="font-poppins-medium text-[13px] text-accent">
                Esqueceu a senha?
              </Text>
            </Pressable>
          </View>
        </View>

        {errors.general && (
          <Text className="font-poppins text-sm text-red-500">
            {errors.general}
          </Text>
        )}

        <View className="flex-1" />

        <View className="gap-4 pb-2">
          <Pressable
            onPress={handleSignIn}
            disabled={loading}
            className="h-14 items-center justify-center rounded-xl bg-accent"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-base text-white">
                Entrar
              </Text>
            )}
          </Pressable>

          <Divider />

          <SocialButtons
            onGooglePress={() => handleOAuth(startGoogle)}
            onApplePress={() => handleOAuth(startApple)}
            disabled={loading}
          />

          <View className="flex-row items-center justify-center gap-1 py-2">
            <Text className="font-poppins text-sm text-muted">
              Não tem uma conta?
            </Text>
            <Pressable onPress={() => router.replace("/(auth)/sign-up")}>
              <Text className="font-poppins-semibold text-sm text-accent">
                Criar conta
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify on device**

Compare with design (frame `PW7C6`). Check fields, "Esqueceu a senha?" link, error state, loading.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(auth)/sign-in.tsx"
git commit -m "feat(mobile): implement Sign In screen with Clerk custom flow (M-AUTH-03)"
```

---

### Task 8: Email Verification screen (AUTH-04)

**Files:**
- Create: `apps/mobile/app/(auth)/verify-email.tsx`

- [ ] **Step 1: Implement Email Verification**

```tsx
// apps/mobile/app/(auth)/verify-email.tsx
import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignUp } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Timer } from "lucide-react-native";
import { BackButton } from "@/components/BackButton";

const CODE_LENGTH = 6;
const EXPIRY_SECONDS = 5 * 60; // 5 minutes

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { signUp, setActive } = useSignUp();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(EXPIRY_SECONDS);
  const inputs = useRef<(TextInput | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(interval);
  }, [seconds]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) text = text.slice(-1);
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    setError("");

    if (text && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const assignRole = async () => {
    const userType = await AsyncStorage.getItem("userType");
    if (!userType) return;
    // TODO: call POST /v1/users/me/role when API client is ready
    // For now, role will be assigned on first app launch via the API
  };

  const handleVerify = async () => {
    if (!signUp) return;
    const codeStr = code.join("");
    if (codeStr.length < CODE_LENGTH) {
      setError("Digite o código completo");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: codeStr,
      });
      if (result.status === "complete" && setActive) {
        await setActive({ session: result.createdSessionId });
        await assignRole();
        router.replace("/(app)");
      }
    } catch (err: any) {
      const clerkErrors = err?.errors;
      if (clerkErrors?.[0]) {
        setError(clerkErrors[0].longMessage || "Código inválido");
      } else {
        Alert.alert("Erro", "Não foi possível verificar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signUp) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setSeconds(EXPIRY_SECONDS);
      setCode(Array(CODE_LENGTH).fill(""));
      setError("");
      inputs.current[0]?.focus();
    } catch {
      Alert.alert("Erro", "Não foi possível reenviar o código.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="flex-1 gap-7 px-6 pt-2">
        <BackButton />

        <View className="gap-4">
          <Text
            className="font-poppins-bold text-primary"
            style={{ fontSize: 28, letterSpacing: -1 }}
          >
            Verificar e-mail
          </Text>
          <View className="gap-1">
            <Text className="font-poppins text-[15px] text-muted">
              Enviamos um código de 6 dígitos para
            </Text>
            <Text className="font-poppins-semibold text-[15px] text-primary">
              {email}
            </Text>
          </View>
        </View>

        {/* Code input */}
        <View className="items-center gap-6">
          <View className="flex-row justify-center gap-3">
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputs.current[i] = ref; }}
                value={digit}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, i)
                }
                keyboardType="number-pad"
                maxLength={1}
                className={`h-14 w-12 rounded-xl border bg-surface text-center font-poppins-semibold text-2xl text-primary ${
                  i === code.findIndex((d) => !d)
                    ? "border-2 border-accent"
                    : "border-surface-border"
                }`}
              />
            ))}
          </View>

          {error ? (
            <Text className="font-poppins text-sm text-red-500">{error}</Text>
          ) : null}

          {/* Timer */}
          <View className="flex-row items-center justify-center gap-1.5">
            <Timer size={14} color="#525252" />
            <Text className="font-poppins text-[13px] text-[#525252]">
              Código expira em {formatTime(seconds)}
            </Text>
          </View>

          {/* Resend */}
          <View className="flex-row items-center gap-1">
            <Text className="font-poppins text-sm text-muted">
              Não recebeu o código?
            </Text>
            <Pressable onPress={handleResend}>
              <Text className="font-poppins-semibold text-sm text-accent">
                Reenviar
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-1" />

        {/* CTA */}
        <View className="pb-2">
          <Pressable
            onPress={handleVerify}
            disabled={loading}
            className="h-14 items-center justify-center rounded-xl bg-accent"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold text-base text-white">
                Verificar
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify on device**

Compare with design (frame `YHqfF`). Check:
- 6 digit boxes with active state (purple border on next empty)
- Timer counting down
- Resend link
- Back button
- Error state when entering wrong code

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(auth)/verify-email.tsx"
git commit -m "feat(mobile): implement Email Verification screen with Clerk (M-AUTH-04)"
```

---

### Task 9: Final verification and commit

- [ ] **Step 1: Set real Clerk key in `.env`**

Ask user to set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `apps/mobile/.env` with their real Clerk publishable key.

- [ ] **Step 2: Full flow test**

1. Fresh app → onboarding → select role → auth welcome landing
2. Tap "Criar conta" → fill form → submit → verify email screen
3. Enter code → verified → lands on (app) placeholder
4. Kill app, reopen → should skip onboarding + auth, go to (app)
5. Test "Entrar" flow with existing account
6. Test Google OAuth button
7. Test back navigation on all screens

- [ ] **Step 3: Commit any fixes**

```bash
git add apps/mobile/
git commit -m "fix(mobile): polish auth screens after device testing"
```
