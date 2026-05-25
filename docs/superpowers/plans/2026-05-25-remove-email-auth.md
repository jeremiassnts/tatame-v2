# Remove Email Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove email/password authentication and keep only Google and Apple social login.

**Architecture:** Rewrite the auth welcome screen to show only two full-width social login buttons. Delete the sign-in, sign-up, and verify-email screens. Remove the now-orphaned SocialButtons component.

**Tech Stack:** React Native, Expo Router, Clerk SSO, NativeWind

---

### Task 1: Rewrite Welcome Screen (social-only)

**Files:**
- Modify: `apps/mobile/app/(auth)/index.tsx`

- [ ] **Step 1: Rewrite the auth welcome screen**

Replace the entire contents of `apps/mobile/app/(auth)/index.tsx` with:

```tsx
import { useStartSSO } from "@/lib/hooks/use-start-sso";
import GoogleIcon from "@/assets/icons/google.svg";
import AppleIcon from "@/assets/icons/apple.svg";
import { Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthWelcomeScreen() {
  const { handleSSO } = useStartSSO();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <View className="flex-1 items-center justify-center gap-10 px-6">
        <View className="items-center gap-2">
          <View className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-[22px] bg-[#242424]">
            <Image
              source={require("@/assets/images/icon.png")}
              className="h-[60px] w-[60px]"
              resizeMode="contain"
            />
          </View>

          <View className="mt-4 items-center gap-2">
            <Text
              className="font-poppins-bold text-primary"
              style={{ fontSize: 32, letterSpacing: -1 }}
            >
              TATAME
            </Text>
            <Text className="font-poppins text-center text-[15px] text-[#525252]">
              Sua academia na palma da mão
            </Text>
          </View>
        </View>

        <View className="w-full gap-3">
          <Pressable
            onPress={() => handleSSO("oauth_google")}
            className="h-14 flex-row items-center justify-center gap-3 rounded-xl border border-surface-border bg-surface"
          >
            <GoogleIcon width={20} height={20} />
            <Text className="font-poppins-semibold text-base text-primary">
              Entrar com Google
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleSSO("oauth_apple")}
            className="h-14 flex-row items-center justify-center gap-3 rounded-xl border border-surface-border bg-surface"
          >
            <AppleIcon width={20} height={20} />
            <Text className="font-poppins-semibold text-base text-primary">
              Entrar com Apple
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd apps/mobile && npx expo export --platform ios --no-minify 2>&1 | head -20`

Expected: No import errors or missing modules.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(auth\)/index.tsx
git commit -m "feat(auth): rewrite welcome screen with social-only login (TAT-126)"
```

---

### Task 2: Remove email auth screens

**Files:**
- Delete: `apps/mobile/app/(auth)/sign-in.tsx`
- Delete: `apps/mobile/app/(auth)/sign-up.tsx`
- Delete: `apps/mobile/app/(auth)/verify-email.tsx`

- [ ] **Step 1: Delete the three email auth screens**

```bash
rm apps/mobile/app/\(auth\)/sign-in.tsx
rm apps/mobile/app/\(auth\)/sign-up.tsx
rm apps/mobile/app/\(auth\)/verify-email.tsx
```

- [ ] **Step 2: Verify no remaining imports reference deleted files**

Run: `grep -r "sign-in\|sign-up\|verify-email" apps/mobile/app/(auth)/`

Expected: No matches (only `sso-callback.tsx` and `index.tsx` remain, neither references deleted files).

- [ ] **Step 3: Commit**

```bash
git add -A apps/mobile/app/\(auth\)/
git commit -m "feat(auth): remove email sign-in, sign-up, and verify-email screens (TAT-126)"
```

---

### Task 3: Remove SocialButtons component

**Files:**
- Delete: `apps/mobile/components/SocialButtons.tsx`

- [ ] **Step 1: Delete the orphaned component**

```bash
rm apps/mobile/components/SocialButtons.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "SocialButtons" apps/mobile/`

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/SocialButtons.tsx
git commit -m "chore(auth): remove orphaned SocialButtons component (TAT-126)"
```

---

### Task 4: Verify full auth flow

- [ ] **Step 1: Verify typecheck passes**

Run: `npx turbo typecheck --filter=@tatame/mobile`

Expected: Success (typecheck is currently skipped for mobile but confirms no build errors in dependencies).

- [ ] **Step 2: Run the app and test manually**

Start dev server: `cd apps/mobile && npx expo start`

Verify:
1. Auth screen shows logo, title, tagline, and two buttons ("Entrar com Google", "Entrar com Apple")
2. No email fields or "forgot password" links anywhere
3. Tapping "Entrar com Google" opens the OAuth flow
4. Tapping "Entrar com Apple" opens the OAuth flow
5. After successful auth, user is redirected to the app

- [ ] **Step 3: Final commit (if any adjustments needed)**

```bash
git add -A
git commit -m "fix(auth): adjustments from manual testing (TAT-126)"
```
