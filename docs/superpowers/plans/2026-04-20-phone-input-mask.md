# Phone Input Mask Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Brazilian phone mask `(XX) XXXXX-XXXX` to the academy creation and settings forms, storing only digits.

**Architecture:** A new `PhoneInput` component wraps `MaskedTextInput` from `react-native-mask-text` with the same visual styling as `FormInput`. The component accepts raw digits and emits raw digits, handling formatting internally. Both `create-academy.tsx` and `settings.tsx` swap their phone `FormInput` for `PhoneInput`.

**Tech Stack:** React Native, react-native-mask-text, react-hook-form, NativeWind

---

### Task 1: Install `react-native-mask-text`

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install the dependency**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2 && pnpm add react-native-mask-text --filter @tatame/mobile
```

- [ ] **Step 2: Verify installation**

```bash
grep "react-native-mask-text" apps/mobile/package.json
```

Expected: a line with `"react-native-mask-text": "^x.x.x"` in dependencies.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore(mobile): add react-native-mask-text dependency"
```

---

### Task 2: Create `PhoneInput` component

**Files:**
- Create: `apps/mobile/components/PhoneInput.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { MaskedTextInput } from "react-native-mask-text";
import { View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";

type PhoneInputProps = {
  label: string;
  /** Raw digits (unmasked), e.g. "11999999999" */
  value: string | null;
  /** Called with digits only */
  onChangePhone: (digits: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Optional leading icon (used in settings screen) */
  leftIcon?: LucideIcon;
};

export function PhoneInput({
  label,
  value,
  onChangePhone,
  onBlur,
  error,
  leftIcon: LeftIcon,
}: PhoneInputProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <Text className="font-poppins-medium text-[13px] text-muted">
          {label}
        </Text>
      ) : null}
      <View
        className={`h-[52px] flex-row items-center rounded-xl border bg-surface px-4 ${
          error ? "border-red-500" : "border-surface-border"
        } ${LeftIcon ? "gap-2.5" : ""}`}
      >
        {LeftIcon ? <LeftIcon size={18} color="#525252" /> : null}
        <MaskedTextInput
          mask="(99) 99999-9999"
          keyboardType="phone-pad"
          placeholder="(11) 99999-9999"
          placeholderTextColor="#525252"
          value={value ?? ""}
          onChangeText={(_formatted, unmasked) => {
            onChangePhone(unmasked);
          }}
          onBlur={onBlur}
          autoCorrect={false}
          className="flex-1 font-poppins text-[15px] text-primary"
        />
      </View>
      {error ? (
        <Text className="font-poppins text-xs text-red-500">{error}</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/PhoneInput.tsx
git commit -m "feat(mobile): create PhoneInput component with Brazilian mask"
```

---

### Task 3: Replace phone field in `create-academy.tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/create-academy.tsx:1-3` (imports)
- Modify: `apps/mobile/app/(app)/create-academy.tsx:145-159` (contactPhone Controller)

- [ ] **Step 1: Add the import**

Add to the imports at the top of `create-academy.tsx`:

```tsx
import { PhoneInput } from "@/components/PhoneInput";
```

- [ ] **Step 2: Replace the contactPhone Controller render**

Replace lines 145–159 (the `contactPhone` Controller block):

**Before:**
```tsx
<Controller
  control={control}
  name="contactPhone"
  render={({ field: { onChange, onBlur, value } }) => (
    <FormInput
      label="Telefone de contato"
      placeholder="(11) 99999-9999"
      value={value ?? ""}
      onChangeText={(t) => onChange(t || null)}
      onBlur={onBlur}
      keyboardType="phone-pad"
      error={errors.contactPhone?.message}
    />
  )}
/>
```

**After:**
```tsx
<Controller
  control={control}
  name="contactPhone"
  render={({ field: { onChange, onBlur, value } }) => (
    <PhoneInput
      label="Telefone de contato"
      value={value}
      onChangePhone={(digits) => onChange(digits || null)}
      onBlur={onBlur}
      error={errors.contactPhone?.message}
    />
  )}
/>
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(app\)/create-academy.tsx
git commit -m "feat(mobile): use PhoneInput in create-academy form"
```

---

### Task 4: Replace phone field in `settings.tsx`

**Files:**
- Modify: `apps/mobile/app/(app)/(manager)/(home)/settings.tsx:1-3` (imports)
- Modify: `apps/mobile/app/(app)/(manager)/(home)/settings.tsx:194-209` (contactPhone Controller)

- [ ] **Step 1: Add the import**

Add to the imports at the top of `settings.tsx`:

```tsx
import { PhoneInput } from "@/components/PhoneInput";
```

- [ ] **Step 2: Replace the contactPhone Controller render**

Replace lines 194–209 (the `contactPhone` Controller block):

**Before:**
```tsx
<Controller
  control={control}
  name="contactPhone"
  render={({ field: { onChange, onBlur, value } }) => (
    <FormInput
      label="Telefone"
      placeholder="(11) 99999-9999"
      value={value ?? ""}
      onChangeText={(t) => onChange(t || null)}
      onBlur={onBlur}
      keyboardType="phone-pad"
      leftIcon={Phone}
      error={errors.contactPhone?.message}
    />
  )}
/>
```

**After:**
```tsx
<Controller
  control={control}
  name="contactPhone"
  render={({ field: { onChange, onBlur, value } }) => (
    <PhoneInput
      label="Telefone"
      value={value}
      onChangePhone={(digits) => onChange(digits || null)}
      onBlur={onBlur}
      leftIcon={Phone}
      error={errors.contactPhone?.message}
    />
  )}
/>
```

- [ ] **Step 3: Remove unused `Phone` import if no longer used elsewhere**

Check if `Phone` from `lucide-react-native` is used anywhere else in settings.tsx. It is only used for the phone field, but since `PhoneInput` accepts `leftIcon`, the import is still needed. No change required.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(app\)/\(manager\)/\(home\)/settings.tsx
git commit -m "feat(mobile): use PhoneInput in academy settings form"
```

---

### Task 5: Manual smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd /Volumes/ExternalDisk1/repos/tatame-v2/apps/mobile && npx expo start
```

- [ ] **Step 2: Test create-academy screen**

1. Navigate to the create academy screen
2. Tap the phone field and type `11999999999`
3. Verify the display shows `(11) 99999-9999`
4. Submit the form and verify the API receives digits only

- [ ] **Step 3: Test settings screen**

1. Navigate to academy settings
2. Verify existing phone data loads correctly (if digits, should auto-format)
3. Edit the phone, verify mask works
4. Save and verify payload contains digits only

- [ ] **Step 4: Test edge cases**

1. Paste a full phone number — verify it masks correctly
2. Backspace through the number — verify formatting adjusts
3. Clear the field completely — verify `null` is submitted
4. Test on both iOS and Android keyboards

- [ ] **Step 5: Final commit with version bump (if needed)**

```bash
git add -A
git commit -m "feat(mobile): add phone input mask (TAT-91)"
```
