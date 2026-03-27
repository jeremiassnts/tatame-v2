# Graduation Screens Design

**Date:** 2026-03-27
**Screen ID:** M-MGR-16 (Pencil Node: 0D9MR)
**Scope:** Promotion screen for belt graduation, instructor members screens, and API adjustments to support promoting both students and instructors.

---

## Overview

Instead of standalone graduation management screens, the promotion flow is accessed directly from a member's profile. Both manager and instructor can promote students. Managers can additionally promote instructors.

## Navigation Flow

### Manager
1. Tab "Membros" → lista de membros
2. Tap membro → detalhe (`[membershipId].tsx`)
3. Botão "Promover graduação" → tela de promoção (`promote-graduation.tsx`)

### Instructor
1. Tab "Membros" (nova) → lista de membros (reutiliza `MembersListContent`)
2. Tap membro → detalhe (`[membershipId].tsx`)
3. Botão "Promover graduação" → tela de promoção (`promote-graduation.tsx`)

Instructors can only promote students. Managers can promote students and instructors.

## Tela de Promoção (`(app)/promote-graduation.tsx`)

Shared route outside role groups (like `profile.tsx`). Receives query params: `userId` (target user DB id) and `membershipId` (for back navigation context).

### Layout (based on design Node 0D9MR)

**1. Nav Row**
- Back button (chevron-left, 40x40, `#1A1A1A` bg, `#2A2A2A` border, cornerRadius 12)
- Title: dynamic — "Promover aluno" or "Promover instrutor" based on target member's role
- Spacer for centering

**2. Member Card**
Card container: `#1A1A1A` bg, `#2A2A2A` border, cornerRadius 16, padding 16, gap 14.

- **Member Row:** Avatar (42x42, gradient fallback) + name (Inter 16 semibold, white) + subtitle "Faixa [belt] · [n] graus atuais" (Inter 12 medium, `#ABABAB`)
- **Current Belt Banner:** Purple dot (10x10, `#7E57C2`) + text "Graduação atual registrada e pronta para promoção" (Inter 12 medium, `#ABABAB`). Background `#A078E815`, cornerRadius 10, padding 10x12.
- If member has no current belt, banner says "Nenhuma graduação registrada" and form is hidden (member must register initial belt first).

**3. Promotion Form Card**
Card container: `#1A1A1A` bg, `#2A2A2A` border, cornerRadius 16, padding 16, gap 12.

- Title: "Nova promoção" (Inter 14 semibold, `#ABABAB`)
- **Nova faixa:** label (Inter 13 semibold, white) + ModalSelect with belt options (Branca, Azul, Roxa, Marrom, Preta). Input style: `#121212` bg, `#2A2A2A` border, cornerRadius 10, height 46, padding 0x14. Pre-selected to next logical belt.
- **Novos graus:** label (Inter 13 semibold, white) + ModalSelect with stripe options (0 to max for selected belt). Input style same as above. Pre-selected to 0.
- **Notas (opcional):** label (Inter 13 semibold, white) + TextInput multiline, `#121212` bg, `#2A2A2A` border, cornerRadius 10, height 88, padding 12. Placeholder: "Ex.: evolução consistente nas últimas semanas." (Inter 13 medium, `#525252`).
- **Promote Button:** full width, height 56, cornerRadius 12, bg `#A078E8`. Icon `arrow-up-right` (white, 20x20) + text "Promover com confirmação" (Inter 16 semibold, white). Centered, gap 8. Submits directly (no confirmation dialog). Disabled while mutation is pending.

**4. Promotion History**
- Section title: "Histórico de promoções" (Inter 14 semibold, `#ABABAB`)
- List of history cards. Each card: `#1A1A1A` bg, `#2A2A2A` border, cornerRadius 12, padding 12x14, gap 3.
  - Title: "dd/mm/yyyy · [Belt prev] [stripes] → [Belt new] [stripes]" (Inter 13 semibold, white)
  - Subtitle: "Promovido por [promoter name] · [notes]" (Inter 11 medium, `#ABABAB`)
- If no history, show empty state text.

**5. Layout order (top to bottom, scrollable)**
1. Nav row
2. Member card
3. Promotion form card (hidden if no current belt)
4. History section title
5. History list
6. Bottom safe area padding

### Behaviors

- On mount: fetch `GET /graduations/?userId={userId}` for history + current belt
- Form uses React Hook Form + Zod
- Belt select: when belt changes, reset stripes to 0 and update max stripes for new belt
- On submit: `POST /graduations/` with `{ userId, belt, stripes, notes }`
- On success: invalidate graduation queries, show success feedback, optionally navigate back
- Disabled state: button disabled if no belt selected or mutation is pending

### Data needed for history display

The current `GET /graduations/?userId=` returns promotion records but does NOT include the promoter's name. The history UI shows "Promovido por [name]". Two options:
- Expand the graduation response to include `promotedByName`
- This requires a join in the repository

We will expand the response to include `promotedByName: string`.

## Member Detail — Promote Button

### Manager (`(manager)/(members)/[membershipId].tsx`)

Add a "Promover graduação" button above the existing "Bloquear membro" button.

- Style: `#A078E8` bg, cornerRadius 12, height 48, flex-row centered, gap 8
- Icon: `arrow-up-right` (white, 16x16)
- Text: "Promover graduação" (Poppins semibold 14, white)
- Visible when: `member.status === "active"` AND `member.role !== "manager"`
- On press: `router.push({ pathname: "/(app)/promote-graduation", params: { userId: member.userId, membershipId } })`

### Instructor (`(instructor)/(members)/[membershipId].tsx`)

Same button, but visible only when `member.role === "student"` (instructors can only promote students).

## Instructor Members Screens (new)

### Tab change

In `(instructor)/_layout.tsx`:
- Replace the hidden graduation tab (`href: null`) with a visible "Membros" tab
- Icon: `Users` from lucide
- Title: "Membros"
- Points to `(members)` group
- Delete the `(graduation)` folder (placeholder files `_layout.tsx` and `index.tsx`) — no longer needed since graduation is accessed from member detail

### Files to create

**`(instructor)/(members)/_layout.tsx`** — Stack navigator (same pattern as manager members)

**`(instructor)/(members)/index.tsx`** — Member list
- Reuses `MembersListContent` component
- Filters: show only students and instructors (not managers)
- `allowMemberDetails: true`
- Href builder: points to `/(app)/(instructor)/(members)/${item.id}`

**`(instructor)/(members)/[membershipId].tsx`** — Member detail
- Same layout as manager's member detail
- Shows: avatar, name, badges, contact info card, membership history
- Bottom button: "Promover graduação" (visible only for active students)
- NO "Bloquear membro" button (only managers can block)

## API Changes

### Rename `studentUserId` → `userId`

In `packages/validators/src/graduation.schema.ts`:
- Rename `studentUserId` to `userId` in `promoteStudentBeltBodySchema`
- Rename the schema itself to `promoteBeltBodySchema` (and type to `PromoteBeltBody`)

In `apps/api/src/modules/graduation/graduation.routes.ts`:
- Update references from `body.studentUserId` to `body.userId`
- Update imports to use new schema/type names

In `apps/api/src/modules/graduation/graduation.service.ts`:
- Rename `promoteStudent` method to `promoteMember`
- Rename `studentUserId` param to `targetUserId`
- Update `assertStaffCanListStudent` to `assertStaffCanListMember`

### Allow promoting instructors (manager only)

In `graduation.service.ts`, update `promoteMember` (currently `promoteStudent`):
- Current logic: rejects if target's membership role is not `student`
- New logic:
  - If actor is **manager**: allow promoting members with role `student` OR `instructor`
  - If actor is **instructor**: only allow promoting members with role `student`

Similarly update `assertStaffCanListMember` (currently `assertStaffCanListStudent`):
- If actor is manager: allow listing graduations for students and instructors
- If actor is instructor: only allow listing for students

### Expand graduation response with promoter name

In `graduation.repository.ts` / `graduation.repository.postgres.ts`:
- Update `listByUserInAcademy` to JOIN with `users` table on `promotedBy` to get the promoter's name
- Add `promotedByName: string` to the returned rows

In `packages/validators/src/graduation.schema.ts`:
- Add `promotedByName: z.string()` to `beltPromotionResponseSchema`

In `graduation.routes.ts`:
- Include `promotedByName` in `formatPromotion`

## New Mobile Hooks

### `usePromoteGraduation()`

In `apps/mobile/lib/hooks/use-graduation.ts`:
- `useMutation` with `POST /graduations/`
- Body: `{ userId, belt, stripes, notes? }`
- On success: invalidate `["graduation", userId]` queries

### `useGraduationHistory(userId)`

In `apps/mobile/lib/hooks/use-graduation.ts`:
- `useQuery` with `GET /graduations/?userId={userId}`
- Query key: `["graduation", userId]`
- Returns full list of promotions

## Files to Create/Modify

### New files:
- `apps/mobile/app/(app)/promote-graduation.tsx` — promotion screen
- `apps/mobile/app/(app)/(instructor)/(members)/_layout.tsx` — stack layout
- `apps/mobile/app/(app)/(instructor)/(members)/index.tsx` — member list
- `apps/mobile/app/(app)/(instructor)/(members)/[membershipId].tsx` — member detail

### Modified files:
- `apps/mobile/app/(app)/(manager)/(members)/[membershipId].tsx` — add promote button
- `apps/mobile/app/(app)/(instructor)/_layout.tsx` — add Members tab, remove graduation placeholder
- `apps/mobile/lib/hooks/use-graduation.ts` — add usePromoteGraduation, useGraduationHistory
- `packages/validators/src/graduation.schema.ts` — rename studentUserId → userId, rename schema, add promotedByName
- `apps/api/src/modules/graduation/graduation.routes.ts` — update field name, include promotedByName
- `apps/api/src/modules/graduation/graduation.service.ts` — rename methods, allow instructor promotion by manager
- `apps/api/src/modules/graduation/graduation.service.test.ts` — update tests for renamed methods + new instructor promotion case
- `apps/api/src/modules/graduation/graduation.repository.ts` — update return type with promotedByName
- `apps/api/src/modules/graduation/graduation.repository.postgres.ts` — join users table for promoter name
- `apps/api/src/modules/graduation/graduation.repository.in-memory.ts` — add promotedByName to returned data
