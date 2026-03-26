# Schedule & Class Screens Design Spec

**Date**: 2026-03-26
**Scope**: Class schedule, detail, create/edit screens for Manager, Instructor, and Student roles + Student Home, Register Belt

---

## Overview

Implements the class schedule system across all three roles (manager, instructor, student) using shared components with role-based props. Also includes the student home dashboard and initial belt registration flow.

**Approach**: Opção C — Telas por role como thin wrappers, componentes compartilhados com props de permissão.

**Total screens**: 11 (3 manager, 4 instructor, 4 student)

---

## 1. Routing Structure

### Manager (existing folder `/(manager)/`)

| Screen ID | Route | Description |
|-----------|-------|-------------|
| M-MGR-07 | `/(manager)/(classes)/index.tsx` | Class schedule list by weekday |
| M-MGR-08 | `/(manager)/(classes)/[classId].tsx` | Class detail + check-ins |
| M-MGR-09 | `/(manager)/(classes)/create.tsx` | Create class |
| M-MGR-09 | `/(manager)/(classes)/edit/[classId].tsx` | Edit class |

### Instructor (new folder `/(instructor)/`)

| Screen ID | Route | Description |
|-----------|-------|-------------|
| M-INS-04 | `/(instructor)/(home)/index.tsx` | Instructor home |
| M-INS-05 | `/(instructor)/(classes)/index.tsx` | My classes by weekday |
| M-INS-06 | `/(instructor)/(classes)/[classId].tsx` | Class detail + check-ins |
| M-INS-07 | `/(instructor)/(classes)/create.tsx` | Create class (instructor fixed) |
| M-INS-07 | `/(instructor)/(classes)/edit/[classId].tsx` | Edit class (instructor fixed) |

### Student (new folder `/(student)/`)

| Screen ID | Route | Description |
|-----------|-------|-------------|
| M-STU-04 | `/(student)/register-belt.tsx` | Register initial belt |
| M-STU-05 | `/(student)/(home)/index.tsx` | Student home dashboard |
| M-STU-06 | `/(student)/(classes)/index.tsx` | Weekly class schedule |
| M-STU-07 | `/(student)/(classes)/[classId].tsx` | Class detail (read-only + check-in) |

**Note**: `/(instructor)/` and `/(student)/` need `_layout.tsx` with appropriate tab bars:
- Instructor: 4 tabs (Início, Aulas, Graduação, Academia)
- Student: Navigation from Home screen (no bottom tab bar in designs — student navigates to schedule via "Ver todas" link and to class detail via card taps)

---

## 2. Shared Components

All live in `components/`.

### `WeekDayStrip`
Horizontal bar with 7 weekday selectors. Selected day highlighted with `$--accent-primary`. Shows day abbreviation (SEG, TER, etc.) + date number.

**Props:**
- `selectedDay: number` (0-6, 0=Sunday)
- `onDaySelect: (day: number) => void`

**Used in:** M-MGR-07, M-INS-05, M-STU-06

### `ClassCard`
Card showing class info in a list. Displays start/end time, name, instructor name, available spots.

**Props:**
- `classData: Class`
- `onPress: () => void`
- `showCheckinButton?: boolean` (default false)
- `onCheckin?: () => void`
- `checkinDisabled?: boolean`
- `checkinDisabledReason?: string`

**Used in:** M-MGR-07, M-INS-05, M-STU-05, M-STU-06

### `ClassDetailView`
Full class detail view with info card and optional check-in list.

**Props:**
- `classData: Class`
- `checkins?: Checkin[]`
- `canEdit?: boolean`
- `canDelete?: boolean`
- `canCheckin?: boolean`
- `checkinDisabled?: boolean`
- `checkinDisabledReason?: string`
- `showCheckins?: boolean`
- `onEdit?: () => void`
- `onDelete?: () => void`
- `onCheckin?: () => void`

**Role config:**
- Manager: `canEdit=true, canDelete=true, showCheckins=true`
- Instructor: `canEdit=true, showCheckins=true`
- Student: `canCheckin=true, showCheckins=false`

**Used in:** M-MGR-08, M-INS-06, M-STU-07

### `ClassForm`
Complete form for creating/editing a class.

**Props:**
- `mode: 'create' | 'edit'`
- `canSelectInstructor?: boolean`
- `initialData?: Partial<Class>`
- `onSubmit: (data: ClassFormData) => void`
- `isSubmitting?: boolean`

**Fields:**
- Name (text, required)
- Description (text, optional)
- Instructor (dropdown if `canSelectInstructor=true`, locked field if false)
- Day of week (dropdown, required)
- Start time / End time (time pickers)
- Max capacity (number input + "Ilimitado" toggle)
- **Multi-day checkboxes** (create mode only): 7 checkboxes for each weekday. When submitting, creates one class per selected day with the same data.

**Used in:** M-MGR-09, M-INS-07

### `CheckinListItem`
Single check-in entry. Avatar + name + check-in timestamp.

**Props:**
- `checkin: Checkin`

**Used in:** `ClassDetailView`

### `CapacityBar`
Occupation bar with label (e.g., "18/20") and gradient color (green → yellow → red as capacity fills).

**Props:**
- `current: number`
- `max: number | null` (null = unlimited)

**Used in:** `ClassDetailView`

---

## 3. API Layer

### Existing Endpoints (no changes needed)

| Method | Endpoint | Use |
|--------|----------|-----|
| `GET` | `/v1/classes?dayOfWeek={n}` | List classes for a day |
| `GET` | `/v1/classes/:classId` | Class detail |
| `POST` | `/v1/classes` | Create class |
| `PATCH` | `/v1/classes/:classId` | Update class |
| `DELETE` | `/v1/classes/:classId` | Deactivate class |
| `POST` | `/v1/checkins` | Record check-in |

### New/Adjusted Endpoints

**`GET /v1/classes/:classId/checkins?date={YYYY-MM-DD}`**
Returns check-ins for a class on a specific date. Ordered by `checkedInAt` ascending (arrival order).

**`POST /v1/graduations/self-register`**
Student registers their initial belt. Body: `{ belt: string, stripes: number }`. Only works if student has no current belt. Returns the created graduation record.

**`GET /v1/subscriptions/me`**
Returns the student's active subscription for the current academy. Needed to verify check-in eligibility and display on student home.

### Query Hooks (`lib/hooks/`)

```
useClasses(dayOfWeek)          — list classes for a weekday
useClass(classId)              — single class detail
useClassCheckins(classId, date) — check-ins for a class on a date
useCreateClass()               — create mutation
useUpdateClass()               — edit mutation
useDeleteClass()               — deactivate mutation
useCheckin()                   — record check-in mutation
useRegisterBelt()              — self-register belt mutation
useMySubscription()            — student's active subscription
```

---

## 4. Student-Specific Screens

### M-STU-04: Register Initial Belt

One-time screen shown when a student is approved but has no belt registered. Routing detects `hasNoBelt` and redirects here.

**Content (top to bottom):**
1. Header with icon + "Qual é sua faixa atual?" + explanatory text
2. Belt selection list (Branca, Azul, Roxa, Marrom, Preta) as radio buttons
3. Stripe selector (0-4) as numeric chips
4. "Confirmar faixa" button → `POST /v1/graduations/self-register` → navigate to Home

**Rule**: After registration, only instructor or manager can change the belt.

### M-STU-05: Student Home

**Sections (top to bottom):**
1. **Header Row**: Academy name + location, notification icon
2. **Conditional Banner**:
   - No active plan → yellow warning: "Você precisa assinar um plano para treinar"
   - Active plan → no banner
3. **Stats Row** (2 cards side by side):
   - Current belt (color + stripes)
   - Weekly check-ins (X/Y where Y = weekly limit from plan, or just X if unlimited)
4. **Subscription Card**: Plan name + validity. If no plan, card with "Assinar plano" CTA (subscription screen out of scope)
5. **Today's Classes**: "Aulas de hoje" label + "Ver todas" link (navigates to M-STU-06). List of `ClassCard` with `showCheckinButton=true`.
   - No plan → check-in button appears disabled
   - Tap disabled check-in → alert explaining need to subscribe

**Inline check-in flow:**
1. Tap "Check-in" on card
2. No plan → modal/alert: "Assine um plano para fazer check-in"
3. With plan → execute check-in → success feedback → update weekly counter

---

## 5. Schedule Screens (All Roles)

### Class Schedule (M-MGR-07 / M-INS-05 / M-STU-06)

All use `WeekDayStrip` + `ClassCard` list. Differences by role:

| Aspect | Manager | Instructor | Student |
|--------|---------|------------|---------|
| Title | "Agenda" | "Minhas aulas" | "Agenda semanal" |
| "+" button in header | Yes → create | Yes → create | No |
| Classes shown | All academy classes | Only their own | All active classes |
| Card tap | → M-MGR-08 | → M-INS-06 | → M-STU-07 |

**Behavior**: Selecting a day in `WeekDayStrip` calls `useClasses(dayOfWeek)`. Shows date label in full ("Quarta-feira, 19 de março"). Scrollable card list. Empty state when no classes for the day.

### Class Detail (M-MGR-08 / M-INS-06 / M-STU-07)

All use `ClassDetailView`. Differences:

| Aspect | Manager | Instructor | Student |
|--------|---------|------------|---------|
| Edit button (header) | Yes | Yes | No |
| Delete button (bottom) | Yes (red) | No | No |
| Check-in button (bottom) | No | No | Yes (gradient) |
| Check-in list visible | Yes | Yes | No |

**Class Info Card** (all roles): Class name, description, time, weekday, instructor, capacity (X/Y), `CapacityBar`.

**Check-in section** (manager/instructor): "Check-ins de hoje" label + `CheckinListItem` list ordered by arrival time.

**Student check-in button states:**
- "Fazer check-in" (enabled, gradient) — can check in
- "Check-in realizado" (disabled, with check icon) — already checked in today
- "Assine um plano" (disabled) — no active subscription

### Create / Edit Class (M-MGR-09 / M-INS-07)

Both use `ClassForm`. Differences:

| Aspect | Manager | Instructor |
|--------|---------|------------|
| Instructor field | Dropdown with academy instructors list | Fixed (their name, locked with lock icon) |

**Multi-day creation** (create mode only): 7 checkboxes for weekdays. On submit, creates one class per selected day with identical data. Multiple `POST /v1/classes` calls.

**Edit mode**: Shows current day (single dropdown, no multi-day option). `PATCH /v1/classes/:classId`.

---

## 6. Check-in Validation Logic

Before allowing a student check-in (both inline and detail screen):

1. **Has active subscription?** No → "Assine um plano para fazer check-in"
2. **Class has capacity?** No → "Aula lotada"
3. **Already checked in today?** Yes → Show as "Check-in realizado" (disabled)

This validation runs client-side for UX, but the API also enforces it server-side.

---

## 7. Members Screen Access

All roles have access to the members screen. The only difference:
- **Manager**: Can block/unblock members
- **Instructor/Student**: Can view members list, but no block option

This is implemented via a `canBlock` prop on the members components. (Members screen implementation details are outside this spec's scope but the routing and permission model applies.)

---

## 8. Out of Scope

- Subscription/payment screens (student can see CTA but flow not implemented here)
- Notification system
- M-INS-08 (Class Attendance) — redundant with class detail
- Push notifications for check-in reminders
