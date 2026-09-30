# TAT-183 — Sign-out on the pre-role screens

## Problem Statement

A user who signs in with the wrong account lands in the joining flow and cannot leave it.
A real customer hit this: she signed up with the wrong email, the account resolved to a
student with no membership, and `(app)/index.tsx` routed her to the academy search screen.
Getting her out required manual intervention.

The screens reached before a role layout mounts have no tab bar and no route to
`profile.tsx`, so the sign-out that exists everywhere else in the app is unreachable from
them.

## Goals

- [ ] A user stranded on any pre-role screen can sign out and reach the login screen
- [ ] Signing out clears the cached query data, so the next account never sees the
      previous one's profile

## Out of Scope

| Item | Reason |
| ---- | ------ |
| Hoisting the session check into `(app)/_layout.tsx` (TAT-183 AC 4) | A guard there affects every signed-in screen, not just the trapped ones. Deferred to its own task so this fix stays low-risk. Tracked as a follow-up on TAT-183. |
| `(onboarding)/user-type.tsx` | Has an indirect exit: "Continuar" syncs the role and routes to the academy search, which this change gives a sign-out. Not a dead end once AC 1 lands. |
| `(onboarding)/index.tsx` | Unreachable — no route navigates to `/(onboarding)` root; `(app)/index.tsx` goes straight to `/(onboarding)/user-type`. |
| `(guardian)/(onboarding)/register-dependent.tsx` | Sits inside the guardian tab layout, so the `(more)` tab and its sign-out are already reachable. |
| Refactoring `profile.tsx` to share the new component | Its sign-out is a row in a settings list, not a standalone footer button. Different affordance, no reuse to gain. |

---

## User Stories

### P1: Escape the academy search screen ⭐ MVP

**User Story**: As a user who signed in with the wrong account, I want to sign out from the
academy search screen so that I can log in with the right one without contacting support.

**Why P1**: This is the exact path the reported customer took. It is the only one confirmed
to have stranded a real user.

**Acceptance Criteria**:

1. WHEN the user is on `search-academy` THEN the system SHALL show a sign-out control at
   the bottom of the screen
2. WHEN the user activates it THEN the system SHALL clear the React Query cache, end the
   Clerk session, and replace the route with `/(auth)`
3. WHEN the sign-out is in flight THEN the control SHALL be disabled, so a double tap
   cannot fire two teardowns

**Independent Test**: Sign in as a student with no membership, land on the search screen,
tap "Sair da conta", arrive at the login screen. Sign in as a different account and confirm
the previous account's name is not shown anywhere.

---

### P1: Escape the pending-approval screen ⭐ MVP

**User Story**: As a user waiting for approval, I want to sign out without cancelling my
join request so that leaving the account does not destroy legitimate pending work.

**Why P1**: The only current exit is "Cancelar solicitação", which routes back to the
search screen at the cost of the user's pending membership. That is a destructive
workaround, not an exit.

**Acceptance Criteria**:

1. WHEN the user is on `pending-approval` THEN the system SHALL show a sign-out control
   below "Cancelar solicitação"
2. WHEN the user signs out from it THEN the membership request SHALL remain pending
3. WHEN the user activates it THEN the system SHALL clear the cache, end the session, and
   replace the route with `/(auth)`

**Independent Test**: Request to join an academy, sit on the pending screen, sign out, log
back in as the same account, and confirm the request is still pending.

---

### P1: Escape the create-academy screen ⭐ MVP

**User Story**: As a manager who has not created an academy yet, I want to sign out from
the create-academy screen so that a wrong-account sign-in is not a hard stop.

**Why P1**: `(app)/index.tsx` sends every manager without an `activeAcademy` here, and the
screen has no exit of any kind — not even a destructive one.

**Acceptance Criteria**:

1. WHEN the user is on `create-academy` THEN the system SHALL show a sign-out control at
   the bottom, below the "Criar academia" button
2. WHEN a submit is in flight THEN the sign-out control SHALL be disabled, so the teardown
   cannot race the academy creation

**Independent Test**: Sign in as a manager with no academy, tap "Sair da conta", arrive at
the login screen.

---

## Edge Cases

- WHEN `signOut()` rejects THEN the control SHALL re-enable rather than leave the screen
  stuck in a disabled state
- WHEN the user taps sign-out twice quickly THEN only one teardown SHALL run
- WHEN the user signs out mid-search on `search-academy` THEN the in-flight academy query
  SHALL be discarded with the cache, not surface an error on the login screen

---

## Requirement Traceability

| Requirement ID | Story | Task | Status |
| -------------- | ----- | ---- | ------ |
| SIGNOUT-01 | Shared control: cache clear → signOut → replace `/(auth)` | T1 | Pending |
| SIGNOUT-02 | Double-tap and in-flight guarding | T1 | Pending |
| SIGNOUT-03 | P1: search-academy exit | T2 | Pending |
| SIGNOUT-04 | P1: pending-approval exit, request preserved | T3 | Pending |
| SIGNOUT-05 | P1: create-academy exit, disabled while submitting | T4 | Pending |
| SIGNOUT-06 | Other pre-role screens audited and ruled out in writing | T5 | Pending |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] No screen reachable from `(app)/index.tsx` leaves a signed-in user without a
      non-destructive way to sign out
- [ ] Zero manual-intervention requests for wrong-account sign-ins after this ships
