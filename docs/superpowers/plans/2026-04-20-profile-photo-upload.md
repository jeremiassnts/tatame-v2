# Profile Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to change their profile photo from the profile screen, using Clerk as source of truth.

**Architecture:** User picks an image via expo-image-picker, uploads it to Clerk via `user.setProfileImage()` from `useUser()` hook, then triggers a sync (`POST /users/me/sync`) to update the local DB. No backend changes needed — the existing sync endpoint already maps `clerkUser.imageUrl` to `profileImageUrl`.

**Tech Stack:** @clerk/clerk-expo (`useUser`), expo-image-picker, React Native

---

### File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/mobile/app/(app)/profile.tsx` | Modify | Add photo picker trigger, upload handler, loading state |

Single file change — the profile screen already has all the building blocks nearby.

---

### Task 1: Add profile photo upload to profile screen

**Files:**
- Modify: `apps/mobile/app/(app)/profile.tsx`

- [ ] **Step 1: Add new imports**

Add these imports to the top of `profile.tsx`:

```tsx
import { useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import { ActivityIndicator } from "react-native";
import { syncUser } from "@/lib/api";
```

Note: `ActivityIndicator` is already imported from `react-native` — just add it to the existing destructure. `useState` is not imported yet — add `useState` to the `react` import (currently only `useCallback, useMemo`).

Updated imports block:

```tsx
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Lock,
  LogOut,
  Mail,
  Trash2,
  UserCheck,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { DatePickerField } from "@/components/DatePickerField";
import { FormInput } from "@/components/FormInput";
import { GradientButton } from "@/components/GradientButton";
import { syncUser } from "@/lib/api";
import { BELT_LABELS_SHORT, getBeltColor } from "@/lib/belts";
import { useMyGraduation } from "@/lib/hooks/use-graduation";
import {
  useCurrentUser,
  useDeleteAccount,
  useUpdateProfile,
} from "@/lib/hooks/use-user";
```

- [ ] **Step 2: Add useUser hook and upload handler**

Inside `ProfileScreen`, after the existing hooks (line ~58), add:

```tsx
const { user: clerkUser } = useUser();
const { getToken } = useAuth();
const [uploadingPhoto, setUploadingPhoto] = useState(false);

const handleChangePhoto = useCallback(async () => {
  if (!clerkUser) return;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return;

  setUploadingPhoto(true);
  try {
    const asset = result.assets[0];
    const response = await fetch(asset.uri);
    const blob = await response.blob();

    await clerkUser.setProfileImage({ file: blob });

    const token = await getToken();
    if (token) {
      await syncUser(token);
    }

    await queryClient.invalidateQueries({ queryKey: ["user", "me"] });
  } catch (e) {
    Alert.alert(
      "Erro",
      e instanceof Error ? e.message : "Não foi possível alterar a foto",
    );
  } finally {
    setUploadingPhoto(false);
  }
}, [clerkUser, getToken, queryClient]);
```

Note: `useAuth` is already imported and destructured as `const { signOut } = useAuth();`. Update to: `const { signOut, getToken } = useAuth();`.

- [ ] **Step 3: Replace static avatar with interactive avatar**

Replace the avatar section (lines 141-147):

**Before:**
```tsx
<View className="items-center" style={{ gap: 12 }}>
  <Avatar
    variant="user"
    imageUrl={user.profileImageUrl}
    fallbackLetter={avatarLetter}
    size={80}
  />
  <Text className="font-poppins-bold text-xl text-primary">
    {user.name}
  </Text>
```

**After:**
```tsx
<View className="items-center" style={{ gap: 12 }}>
  <Pressable onPress={handleChangePhoto} disabled={uploadingPhoto}>
    <View>
      <Avatar
        variant="user"
        imageUrl={user.profileImageUrl}
        fallbackLetter={avatarLetter}
        size={80}
      />
      {uploadingPhoto ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color="#FFFFFF" />
        </View>
      ) : (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: "#A078E8",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: "#0C0C0C",
          }}
        >
          <Camera size={13} color="#FFFFFF" />
        </View>
      )}
    </View>
  </Pressable>
  <Text className="font-poppins-bold text-xl text-primary">
    {user.name}
  </Text>
  <Pressable onPress={handleChangePhoto} disabled={uploadingPhoto}>
    <Text
      className="font-poppins-medium text-[13px]"
      style={{ color: "#A078E8" }}
    >
      Alterar foto
    </Text>
  </Pressable>
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/profile.tsx
git commit -m "feat(mobile): add profile photo upload via Clerk (TAT-83)"
```

---

### Task 2: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx expo start
```

- [ ] **Step 2: Test photo upload flow**

1. Navigate to profile screen
2. Verify camera badge icon is visible on the avatar
3. Verify "Alterar foto" text is visible below the avatar
4. Tap avatar — image picker should open
5. Select and crop an image
6. Verify loading spinner overlay appears on avatar during upload
7. Verify avatar updates with new image after upload
8. Navigate away and back — verify photo persists

- [ ] **Step 3: Test error handling**

1. Cancel image picker — nothing should happen
2. Test with no internet — error Alert should appear

- [ ] **Step 4: Test all roles**

1. Test as student
2. Test as instructor
3. Test as manager
