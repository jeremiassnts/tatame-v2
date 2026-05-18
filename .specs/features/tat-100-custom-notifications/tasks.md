# TAT-100 — Manager Custom Notifications: Task Breakdown

Linear: https://linear.app/tatame/issue/TAT-100

## Dependencies (all Done)

- TAT-95: Push notification foundation (dispatch pipeline, BullMQ worker, push tokens)
- TAT-96: Notification center (list, read/unread, bell icon)

## Reusable Existing Code

| What | Where |
|------|-------|
| `NotificationService.send()` | `apps/api/src/modules/notification/notification.service.ts` |
| `NotificationDispatcher` | `apps/api/src/modules/notification/notification-dispatcher.ts` |
| `sendNotificationBodySchema` | `packages/validators/src/notification.schema.ts` |
| Membership repo (member queries by role) | `apps/api/src/modules/membership/membership.repository.postgres.ts` |
| Notification list screen (filters, cards) | `apps/mobile/app/(app)/notifications.tsx` |
| Notification hooks | `apps/mobile/lib/hooks/use-notifications.ts` |
| Category enum includes `"announcement"` | `packages/db/src/schema/index.ts` |

## Tasks

### T1: Add validator schema for custom notification [API]

- **What:** Create `sendCustomNotificationBodySchema` in validators package
- **Where:** `packages/validators/src/notification.schema.ts`
- **Depends on:** Nothing
- **Details:**
  - `title`: string, min 1, max 200
  - `body`: string, min 1, max 1000
  - `recipientFilter`: enum `"all" | "students" | "instructors" | "specific"`
  - `specificUserIds`: optional array of string UUIDs, required when filter is `"specific"`
  - Export from package index
- **Done when:** Schema validates correct/incorrect payloads
- **Tests:** Unit test for schema validation (valid + invalid cases)
- **Gate:** `pnpm turbo run typecheck`

### T2: Add send-custom endpoint + rate limiting [API]

- **What:** Create `POST /notifications/send-custom` route (manager-only, rate limited) + `GET /notifications/custom-quota` endpoint
- **Where:** `apps/api/src/modules/notification/notification.routes.ts`
- **Depends on:** T1, T3, T4
- **Details:**
  - Auth: `authorize("manager")` + `requireActiveAcademy`
  - Validate body with `sendCustomNotificationBodySchema`
  - Rate limit: query `custom_notification_sends` table count for this academy today. Return 429 if >= 5.
  - Resolve recipients based on `recipientFilter`:
    - `"all"` → `membershipRepo.findAllActiveClerkIdsByAcademy()`
    - `"students"` → `membershipRepo.findActiveStudentClerkIdsByAcademy()`
    - `"instructors"` → `membershipRepo.findActiveInstructorClerkIdsByAcademy()`
    - `"specific"` → resolve provided user IDs to Clerk IDs
  - Insert row in `custom_notification_sends` to track the send action
  - Send via `notificationService.send()` with category `"announcement"`
  - Response: `{ sent: number, remaining: number }` (remaining = 5 - count - 1)
  - `GET /notifications/custom-quota` — returns `{ used: number, limit: 5, remaining: number }` for the active academy today
- **Done when:** Endpoint creates notifications + enqueues push jobs for correct recipients
- **Tests:** Unit test with in-memory repos (valid send, rate limit exceeded, invalid filter)
- **Gate:** `pnpm --filter @tatame/api test:unit`

### T3: Add `findActiveInstructorClerkIdsByAcademy` to membership repo [API]

- **What:** Add method to query instructor Clerk IDs for an academy (mirrors existing student/manager methods)
- **Where:** `apps/api/src/modules/membership/membership.repository.ts` (interface) + `membership.repository.postgres.ts` (implementation)
- **Depends on:** Nothing
- **Details:**
  - Query: `SELECT u.clerk_user_id FROM academy_memberships am JOIN users u ON am.user_id = u.id WHERE am.academy_id = ? AND am.role = 'instructor' AND am.status = 'active' AND am.is_active = true`
  - Also add `findAllActiveClerkIdsByAcademy()` for the "all" filter (all roles, active status)
- **Done when:** Methods return correct Clerk IDs
- **Tests:** Covered by T2 integration
- **Gate:** `pnpm turbo run typecheck`

### T4: Add `countCustomNotificationsSentToday` to notification repo [API]

- **What:** Add method to count today's custom notifications for rate limiting
- **Where:** `apps/api/src/modules/notification/notification.repository.ts` (interface) + postgres implementation
- **Depends on:** Nothing
- **Details:**
  - Query: count distinct notifications where `academyId = ?` AND `category = 'announcement'` AND `createdAt >= start of today (UTC)`
  - Group by a sender marker — add `senderId` to the query or use a distinct title+body+createdAt window
  - Simpler approach: count rows in notifications table grouped by a "batch" concept, or just count unique (academyId, category=announcement, createdAt >= today) sends. Since one `send()` call creates N rows (one per recipient), we need to count sends, not rows. Options:
    - Add a `batchId` column to notifications (migration)
    - OR count distinct `createdAt` values truncated to second (hacky but works for MVP)
    - OR track sends in a separate lightweight table/counter
  - **Decision:** Add a `custom_notification_sends` table with `id, academyId, senderId, createdAt` — one row per send action. Simple, clean, no migration risk to existing table.
  - Run `pnpm db:generate` after adding table to schema
- **Done when:** Table exists, count method returns correct number of sends today
- **Tests:** Unit test
- **Gate:** `pnpm turbo run typecheck`

### T5: Create "Nova Notificacao" screen [Mobile]

- **What:** Build the notification composer form screen matching design (OoacO)
- **Where:** `apps/mobile/app/(app)/(manager)/create-notification.tsx` (new file)
- **Depends on:** T2 (needs endpoint to submit)
- **Details:**
  - Nav: close (X) button, title "Nova Notificação"
  - **Quota Badge** (node `tP06C`): info icon + text "{remaining} de 5 notificações restantes hoje"
    - Background: `#A078E820`, corner radius 10, padding 10/14, full width
    - Icon: lucide `info`, color `#A078E8`, 16px
    - Text: Inter 12px weight 500, color `#A078E8`
    - Fetch quota via `GET /notifications/custom-quota` on screen mount
    - Disable send button + show warning when remaining = 0
  - Title input: max 200 chars, counter "0/200"
  - Body input: multiline, max 1000 chars, counter "0/1000"
  - Recipient chips: Todos (default), Alunos, Instrutores, Específicos
  - When "Específicos" selected: show member list with checkboxes
    - "Selecionar todos" row with member count
    - Member rows: checkbox + avatar initials + name + role label
    - Fetch members via existing `GET /memberships?academyId=...` or equivalent
  - Send button: gradient purple, icon send + "Enviar Notificação"
  - Confirmation dialog before sending: "Enviar notificação para {n} membros?"
  - Success feedback (toast or alert) + refetch quota
  - Use `react-hook-form` (already in project)
- **Done when:** Form submits successfully, notifications received by recipients
- **Tests:** Manual test on device/simulator
- **Gate:** App builds without errors

### T6: Add FAB button + hook to notifications screen [Mobile]

- **What:** Add the floating "+" button (FAB) on the notifications screen, visible only for managers. Create the `useSendCustomNotification` hook.
- **Where:**
  - `apps/mobile/app/(app)/notifications.tsx` (add FAB)
  - `apps/mobile/lib/hooks/use-notifications.ts` (add hook)
- **Depends on:** T2
- **Details:**
  - FAB: absolute positioned, bottom-right, purple gradient, shadow, plus icon
  - Only visible when user has `academyRole === "manager"`
  - Taps navigates to `/(manager)/create-notification`
  - Hook `useSendCustomNotification`: mutation calling `POST /notifications/send-custom`, invalidates quota on success
  - Hook `useCustomNotificationQuota`: query `GET /notifications/custom-quota`, returns `{ used, limit, remaining }`
- **Done when:** Manager sees FAB, taps it, navigates to form. Non-managers don't see FAB.
- **Tests:** Manual test
- **Gate:** App builds without errors

## Execution Order

```
T1 ──┐
T3 ──┼──> T2 ──> T5
T4 ──┘         > T6
```

- **Parallel batch 1:** T1, T3, T4 (no dependencies between them)
- **Sequential:** T2 (depends on T1, T3, T4)
- **Parallel batch 2:** T5, T6 (both depend on T2, independent of each other)

## Status

| Task | Status | Files Changed |
|------|--------|---------------|
| T1 | Pending | |
| T2 | Pending | |
| T3 | Pending | |
| T4 | Pending | |
| T5 | Pending | |
| T6 | Pending | |
