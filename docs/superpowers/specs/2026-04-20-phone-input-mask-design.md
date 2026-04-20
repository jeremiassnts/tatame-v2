# Phone Input Mask — Design Spec

**Linear:** TAT-91
**Date:** 2026-04-20
**Status:** Draft

## Goal

Add a phone input mask to the academy creation and settings forms so numbers are formatted as the user types, using the Brazilian pattern `(XX) XXXXX-XXXX`.

## Decisions

| Decision | Choice |
|---|---|
| Supported formats | Brazil only (`(XX) XXXXX-XXXX`) |
| Stored value format | Digits only (e.g. `11999999999`) |
| Implementation approach | Dedicated `PhoneInput` component using `react-native-mask-text` |
| Schema changes | None — current `z.string().max(50)` accepts digit-only strings |

## Component: `PhoneInput`

**File:** `apps/mobile/components/PhoneInput.tsx`

Wraps `FormInput` visually but replaces the internal `TextInput` with `MaskedTextInput` from `react-native-mask-text`.

### Props

| Prop | Type | Description |
|---|---|---|
| `label` | `string` | Field label |
| `value` | `string \| null` | Raw digits (unmasked) |
| `onChangePhone` | `(digits: string) => void` | Callback with digits only |
| `onBlur` | `() => void` | Blur handler for react-hook-form |
| `error` | `string \| undefined` | Validation error message |

### Behavior

- Mask pattern: `(99) 99999-9999`
- `keyboardType="phone-pad"` is hardcoded
- Placeholder: `(11) 99999-9999`
- The `MaskedTextInput` `onChangeText` provides both the formatted and unmasked values — `onChangePhone` emits only the unmasked digits
- Paste, backspace, and empty state are handled by the library

## Screens Affected

### 1. `apps/mobile/app/(app)/create-academy.tsx`

Replace the `contactPhone` Controller's `FormInput` with `PhoneInput`:

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

### 2. `apps/mobile/app/(app)/(manager)/(home)/settings.tsx`

Same substitution for the `contactPhone` field.

## Validation

No schema changes needed. The `createAcademyBodySchema` field `contactPhone: z.string().max(50).nullable().optional()` accepts digit-only strings (10-11 characters for Brazilian numbers).

## Acceptance Criteria

- Phone field displays `(XX) XXXXX-XXXX` mask while typing on both create-academy and settings screens
- Submitted payload contains only digits (e.g. `11999999999`)
- Paste and backspace work correctly
- No regressions on Android/iOS keyboards
