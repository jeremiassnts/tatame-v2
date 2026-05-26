# Guardian & Dependents Feature Design

## Overview

Feature to support children (kids classes) who don't have their own phone or shouldn't manage payments. Guardians (parents) manage their children's check-ins, subscriptions, and payments through their own account.

Two user scenarios:
1. **Guardian (new role):** doesn't train, only manages dependents
2. **Student with dependents:** trains normally and also manages dependents

Dependents are profiles without login, following the industry standard (Zipper, Wodify, Zen Planner, Wellyx).

---

## Data Model

### New table: `dependents`

| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| guardianId | uuid | FK -> users.id, NOT NULL |
| academyId | uuid | FK -> academies.id, NOT NULL |
| name | text | NOT NULL |
| birthDate | date | NOT NULL |
| createdAt | timestamp | NOT NULL, default now() |
| updatedAt | timestamp | NOT NULL, default now() |
| deletedAt | timestamp | nullable (soft delete) |

### New role

Add `guardian` to the `user_role` pgEnum: `manager`, `instructor`, `student`, `guardian`.

### Altered tables

Add optional `dependentId (uuid, nullable, FK -> dependents.id)` to:
- `checkins`
- `student_subscriptions`
- `payments`
- `belt_promotions`

### New constraints

- `checkins`: unique index on `(dependent_id, class_id, date)` where `dependent_id IS NOT NULL`
- `belt_promotions`: unique partial index on `(dependent_id)` where `is_current = true AND dependent_id IS NOT NULL`

### Semantics

- `dependentId = null` -> operation is for the user themselves
- `dependentId = <id>` -> operation is for the dependent

---

## User Flows

### Guardian (new role)

1. **Onboarding:** Selects "Responsavel" as user type -> searches academy -> requests to join
2. **Approval:** Manager receives membership notification tagged as guardian
3. **Dependent onboarding:** After approval, mandatory screen to register at least 1 dependent (name, birth date, belt)
4. **Home:** Direct shortcut to "Meus Dependentes" (no personal belt/training data)
5. **Menu "Mais":** Notifications, Announcements, Dependents
6. **Check-in:** If 1 dependent, check-in directly. If 2+, modal to select which dependent
7. **Subscription:** Consolidated view of all dependents' plans, selects plan individually per dependent

### Student with dependents

1. **Access:** Menu "Mais" -> "Dependentes" (list/create/edit)
2. **Check-in:** Modal asks "for whom?" showing the student themselves + their dependents
3. **Subscription:** Shows own plan + dependents' plans in same consolidated view

### Manager

1. **Member list:** Dependents appear as normal students with guardian indication
2. **Belt promotion:** Can promote dependents normally
3. **Approval:** Sees guardian tag when approving membership
4. **Visibility:** Only role that sees the full list of dependents in the academy

---

## API Endpoints

### New endpoints (Dependents module)

- `POST /dependents` - Register a dependent (guardian or student with active membership)
- `GET /dependents/me` - List my dependents
- `GET /dependents/:id` - Dependent detail
- `PUT /dependents/:id` - Edit dependent
- `DELETE /dependents/:id` - Soft delete dependent
- `GET /dependents/academy/:academyId` - List all academy dependents (manager only)

### Altered endpoints

- `POST /checkins` - Accept optional `dependentId` in body
- `POST /subscriptions/me/plan` - Accept optional `dependentId`
- `POST /payments` - Accept optional `dependentId`
- `POST /belt-promotions` - Accept optional `dependentId`
- `GET /memberships/academy/:id` - Include dependents in response with guardian info

### Validations

- Only the `guardianId` of a dependent can operate on it
- Manager can view/promote any dependent in the academy
- Guardian cannot create check-in/subscription for themselves (dependentId required)
- Student can only add dependents if they have an active academy membership

---

## Notifications

Reuses existing notification categories with `dependentId` in the `data` JSONB field:

- **Guardian approval:** `new_member` category with `data: { isGuardian: true }`
- **Dependent registered:** `new_member` category with `data: { dependentId, dependentName }`
- **Dependent check-in/subscription/belt:** Existing categories with `dependentId` in `data`, notification sent to guardian
- **No new notification categories needed**

---

## Business Rules

### Guardian
- Cannot have own subscription (`dependentId` required)
- Cannot check-in for themselves (`dependentId` required)
- Does not appear in belt_promotions (doesn't train)
- Must register at least 1 dependent after academy approval
- If leaves academy, all dependents are deactivated (soft delete)

### Student with dependents
- Can have own subscription and check-ins (`dependentId = null`)
- Can also manage dependents normally
- No obligation to register dependents - optional feature

### Dependent
- No limit of dependents per guardian
- Automatically linked to guardian's academy
- Only guardian and manager can view/manage
- Soft delete preserves history (check-ins, payments, belt)
- Initial belt set by guardian at registration, subsequent changes only by manager

### Check-in with dependent
- Same validations as normal: active subscription, class capacity, weekly limit
- Weekly limit is **per dependent** (not shared with guardian)
- Selection modal appears when user has dependents

### Subscription
- Each dependent has their own individual plan
- 3-day grace period works the same
- Consolidated view shows all plans (guardian/student + dependents)

---

## Security & Permissions

### Dependent visibility
- **Guardian:** sees only their own dependents
- **Student without dependents:** sees nothing related to dependents
- **Manager:** sees all academy dependents with guardian indication
- **Instructor:** sees dependents only in class attendance context (check-in list)
- `GET /dependents/academy/:id` restricted to manager

### Minor data protection
- No profile image (avoid storing children's photos)
- Minimal data: name, birth date, belt
- Soft delete preserves history but removes from active listings
- No exposure of dependent data between different guardians/students

### Authorization
- Check-in/subscription/payment with `dependentId`: validate authenticated user is the `guardianId`
- Belt promotion with `dependentId`: validate user is academy manager
- Edit/delete dependent: only `guardianId` or academy manager
