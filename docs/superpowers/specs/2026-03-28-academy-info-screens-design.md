# Academy Info Screens (Student & Instructor)

## Overview

Read-only academy information screens accessible via "Academia" tab for both student and instructor roles. Both use a single shared component (`AcademyInfo`) with the instructor design (M-INS-10) as the visual base, plus the "Membro ativo" card from the student design (M-STU-13). Includes a "Sair da academia" flow.

**Design references:**
- Student design: Node ID `HKRmV` (M-STU-13: Academy Info - Student View)
- Instructor design: Node ID `WXT1J` (M-INS-10: Academy Info)

## Shared Component: `AcademyInfo`

**File:** `apps/mobile/components/AcademyInfo.tsx`

### Props

```ts
type AcademyInfoProps = {
  onLeave: () => void;       // callback when user confirms leaving
  isLeaving: boolean;        // mutation loading state
  memberSince: Date | null;  // joinedAt from membership
};
```

### Layout (vertical scroll)

The component fetches academy data internally via `useAcademyContext()` + `useAcademy(academyId)`.

1. **Nav Row**
   - `BackButton` (existing component) on the left
   - "Academia" title centered (Sora 18px bold, white)
   - 40px spacer on the right for balance

2. **Logo Section** (centered, gap 12)
   - 88x88 frame with accent gradient (`#A078E8` → `#7C5CBF`), cornerRadius 22
   - Academy logo image if available, otherwise first letter of name (Sora 28px bold white)
   - "Somente visualização" text (Inter 13px, muted `#ABABAB`)

3. **Form Fields (read-only)** (vertical, gap 16)
   - 5 fields: Nome, Endereço, E-mail, Telefone, Fundada em
   - Each field: label (Inter 13px 500, `#ABABAB`) + input-style frame (height 52, bg `#1A1A1A`, border `#2A2A2A`, cornerRadius 12, padding horizontal 16)
   - Input text: Inter 14px normal, white
   - Endereço field has `MapPin` icon prefix (muted)
   - E-mail field has `Mail` icon prefix (muted)
   - Telefone field has `Phone` icon prefix (muted)
   - Fundada em shows formatted date or fallback text
   - All fields show fallback "Nao informado" when data is null

4. **Member Card** (horizontal, gap 12, padding 14x16, bg `#1A1A1A`, border `#2A2A2A`, cornerRadius 16)
   - Left: 40x40 frame with `ShieldCheck` icon (accent) on accent-translucent bg, cornerRadius 12
   - Right (vertical, gap 4):
     - "Membro ativo" (Inter 14px 600, white)
     - "Desde {date}" formatted as "dd MMM yyyy" pt-BR (Inter 13px, muted)

5. **Leave Warning Card** (vertical, gap 4, padding 10x12, bg `#242424`, cornerRadius 10)
   - "Atencao" (Inter 12px 600, white)
   - "Ao sair, voce perdera acesso as aulas e recursos desta academia." (Inter 12px, muted, text wrap)

6. **Leave Button** (height 56, bg `#D64B4B`, cornerRadius 12, centered)
   - "Sair da academia" (Inter 16px 600, white)
   - On press: shows `Alert.alert` confirmation dialog
     - Title: "Sair da academia"
     - Message: "Ao sair, voce perdera acesso as aulas e recursos desta academia. Deseja continuar?"
     - Buttons: "Cancelar" (cancel style) | "Sair" (destructive style, calls `onLeave`)
   - Shows `ActivityIndicator` while `isLeaving` is true

## Screen Files

### Instructor Screen

**File:** `apps/mobile/app/(app)/(instructor)/(academy)/index.tsx`

Replaces the current placeholder ("Em breve"). Renders `<AcademyInfo>` with:
- `onLeave`: calls `useCancelMembership().mutate()`
- `isLeaving`: mutation `isPending` state
- `memberSince`: from `useCurrentUser().data.activeMembership.joinedAt`

### Student Screen

**New files:**
- `apps/mobile/app/(app)/(student)/(academy)/_layout.tsx` — Stack navigator (same pattern as other student groups)
- `apps/mobile/app/(app)/(student)/(academy)/index.tsx` — Renders `<AcademyInfo>` with same props pattern as instructor

## Navigation Changes

### Instructor `_layout.tsx`

Remove `href: null` from the "(academy)" tab to activate it. Tab already exists with:
- Title: "Academia"
- Icon: `School`

### Student `_layout.tsx`

Add new `<Tabs.Screen>` for "(academy)":
- `name`: "(academy)"
- `title`: "Academia"
- `tabBarIcon`: `School` from lucide-react-native

## Backend Changes

### Repository: `findActiveOrPendingByUser`

**File:** `apps/api/src/modules/membership/membership.repository.postgres.ts`

Add `joinedAt` to the select query:
```ts
.select({
  id: academyMemberships.id,
  academyId: academyMemberships.academyId,
  academyName: academies.name,
  academyLogoUrl: academies.logoUrl,
  role: academyMemberships.role,
  status: academyMemberships.status,
  joinedAt: academyMemberships.joinedAt,  // ADD THIS
})
```

Also update the in-memory repository to match.

### Validator Schema

**File:** `packages/validators/src/user.schema.ts`

Add `joinedAt` to `activeMembershipSchema`:
```ts
export const activeMembershipSchema = z.object({
  id: z.string().uuid(),
  academyId: z.string().uuid(),
  academyName: z.string(),
  academyLogoUrl: z.string().nullable(),
  role: roleEnumSchema,
  status: z.enum(["pending", "active", "blocked"]),
  joinedAt: z.coerce.date().nullable(),  // ADD THIS
});
```

## Leave Academy Flow

1. User presses red "Sair da academia" button
2. `Alert.alert` confirmation dialog appears
3. If confirmed: `useCancelMembership().mutate()` calls `POST /memberships/leave`
4. `onSuccess`: invalidates `["user", "me"]` query
5. `(app)/_layout.tsx` re-evaluates user state: `activeMembership` is now null
6. User is automatically redirected to the joining flow (search academy screen)

## Design Tokens Used

| Token | Value | Usage |
|-------|-------|-------|
| background | `#0C0C0C` | Screen bg |
| surface | `#1A1A1A` | Cards, input fields |
| surface-border | `#2A2A2A` | Card borders, separators |
| accent | `#A078E8` | Logo gradient start, shield icon |
| accent-dark | `#7C5CBF` | Logo gradient end |
| accent-translucent | `rgba(160,120,232,0.125)` | Shield icon bg |
| primary | `#FFFFFF` | Text primary |
| muted | `#ABABAB` | Labels, secondary text |
| danger | `#D64B4B` | Leave button bg |
| warning-bg | `#242424` | Warning card bg |

## Existing Code Reused

- `useAcademyContext()` — academy ID, name, logo URL
- `useAcademy(academyId)` — full academy data (address, email, phone, foundedAt)
- `useCancelMembership()` — leave mutation
- `useCurrentUser()` — user data including activeMembership
- `BackButton` component — navigation back
- `Avatar` component — could be used for logo display (has `variant="brand"`)
