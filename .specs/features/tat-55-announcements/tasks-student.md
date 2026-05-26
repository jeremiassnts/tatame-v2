# TAT-55 — Academy Announcements (Student): Task Breakdown

Linear: https://linear.app/tatame/issue/TAT-55
Spec: [spec.md](spec.md) (R8: Student Read-Only Viewing)
Design References: Node IDs 1XnFb (home), RRUuC (list), E7j7f (detail)

## Dependencies on Manager Phase

These tasks depend on shared infrastructure from the manager phase (tasks.md):

| Task | What | Status |
|------|------|--------|
| T1 | DB schema — announcements table | Required |
| T2 | Validator schemas | Required |
| T3 | API module — announcement CRUD | Required |
| T4 | Mobile hooks — useAnnouncements | Required |

All student tasks below require T4 to be complete (hooks provide data access).

## Reusable Existing Code

| What | Where |
|------|-------|
| Student tab layout | `apps/mobile/app/(app)/(student)/_layout.tsx` |
| Student home screen | `apps/mobile/app/(app)/(student)/(home)/index.tsx` |
| `useAnnouncements()` hooks (from T4) | `apps/mobile/lib/hooks/use-announcements.ts` |
| `useCurrentUser()`, `useAcademyContext()` | `apps/mobile/lib/hooks/` |
| Today's classes section pattern | `apps/mobile/app/(app)/(student)/(home)/index.tsx` (reuse section layout) |
| Manager announcement list/detail (reference) | `apps/mobile/app/(app)/(manager)/(more)/announcements.tsx`, `announcement/[id].tsx` |

## Tasks

### ST1: Add "Avisos" tab to student bottom navigation [Mobile — Navigation]

- **What:** Add a dedicated "Avisos" tab to the student bottom tab bar
- **Where:** `apps/mobile/app/(app)/(student)/_layout.tsx`
- **Depends on:** Nothing (navigation structure only)
- **Details:**
  - Current student tabs: (home) Inicio, (members) Membros, (classes) Agenda, (subscription) Assinatura
  - Design (node 1XnFb) shows new tab bar: INICIO, AULAS, **AVISOS**, GRADUACAO, ACADEMIA
  - For this task, add only the AVISOS tab (other tab changes are out of scope for TAT-55)
  - New tab: `(announcements)` — icon: `Megaphone` (lucide), title: "Avisos"
  - Position: 3rd tab (after AULAS/Agenda, before remaining tabs)
  - Create stack layout: `apps/mobile/app/(app)/(student)/(announcements)/_layout.tsx`
  - Tab styling: same as existing (active: `#A078E8`, inactive: `#525252`, bg: `#1A1A1A`)
- **Done when:** "Avisos" tab appears in student bottom nav, navigates to announcements stack
- **Tests:** Manual navigation test
- **Gate:** App builds without errors

### ST2: Add "Ultimos avisos" section to student home screen [Mobile]

- **What:** Add an announcements preview section at the bottom of the student home/dashboard
- **Where:** `apps/mobile/app/(app)/(student)/(home)/index.tsx`
- **Depends on:** T4 (hooks), ST1 (navigation target for "Ver mais")
- **Details:**
  - Design reference: node 1XnFb, "Announcements Section" (node MsmFi)
  - Section header row: "Ultimos avisos" (Sora 16 bold white) + "Ver mais" link (Inter 13 medium, #A078E8)
  - "Ver mais" navigates to announcements list (ST3 screen via AVISOS tab)
  - Feed cards (up to 3 most recent):
    - Left: megaphone icon in purple tinted circle (38x38, #A078E820 bg, #A078E8 icon)
    - Center: title (Inter 14 semibold white) + preview (Inter 12, #8A8A8A, single line with date prefix "DD mmm ·")
    - Right: chevron-right icon (#525252, 16x16)
    - Card: rounded 14, bg #1A1A1A, border #2A2A2A 1px, padding 14, gap 12
  - Tapping a card navigates to announcement detail (ST4)
  - Use `useAnnouncements(academyId)` hook, take first 3 items
  - Hide section entirely if no announcements exist
  - Position: below "Aulas de hoje" section, before scroll end
- **Done when:** Home screen shows latest 3 announcements with correct styling, tapping navigates to detail
- **Tests:** Manual test
- **Gate:** App builds without errors

### ST3: Student announcements list screen [Mobile]

- **What:** Build read-only announcements list screen for students
- **Where:** `apps/mobile/app/(app)/(student)/(announcements)/index.tsx` (new file)
- **Depends on:** T4 (hooks), ST1 (navigation)
- **Details:**
  - Design reference: node RRUuC
  - Header: back arrow + "Avisos" title (centered)
  - Subtitle: "{n} avisos publicados" (muted text below header)
  - FlatList of announcement cards:
    - Date: "DD mmm YYYY" format (Portuguese abbreviated month, e.g. "15 mai 2026")
    - Title (bold, white)
    - Body preview (muted #8A8A8A, truncated ~2 lines)
    - Card: dark background (#1A1A1A or $--bg-card), rounded corners, subtle border
  - NO FAB button (students cannot create announcements)
  - Pull-to-refresh via RefreshControl
  - Infinite scroll via onEndReached (cursor-based pagination from useAnnouncements)
  - Empty state when no announcements
  - Tapping card navigates to detail screen (ST4) with announcement ID
  - Reuse card component/pattern from manager list (T6) if extracted as shared component, otherwise replicate layout
- **Done when:** List renders academy announcements, pagination works, cards navigate to detail
- **Tests:** Manual test
- **Gate:** App builds without errors

### ST4: Student announcement detail screen [Mobile]

- **What:** Build read-only announcement detail screen for students
- **Where:** `apps/mobile/app/(app)/(student)/(announcements)/[id].tsx` (new file)
- **Depends on:** T4 (hooks), ST1 (navigation)
- **Details:**
  - Design reference: node E7j7f (named "M-SHARED-04: Announcement Detail")
  - Route params: `id` (announcement ID)
  - Header: back arrow + "Detalhes do aviso" title
  - Content layout:
    - Cover image placeholder area (if announcement has imageUrl, show image; otherwise show placeholder with image icon)
    - Metadata row: date "DD mmm YYYY" + author name (with calendar and user icons, muted text)
    - Title (large, bold, white)
    - Body text (full content, regular weight, white/light gray)
  - NO edit icon in header
  - NO "Excluir aviso" button
  - Read-only view only
  - Loading state while fetching
  - Error state if announcement not found
  - Use `useAnnouncement(id)` hook
- **Done when:** Detail displays announcement correctly, completely read-only (no edit/delete actions)
- **Tests:** Manual test
- **Gate:** App builds without errors

## Execution Order

```
[Manager T1-T4 must be complete first]
        |
        v
ST1 ─────────────┐
        |         |
        v         v
ST2 ──> ST3 ──> ST4
```

- **ST1** can start immediately (navigation only, no data dependency except tab target)
- **ST2** depends on T4 (data) and ST1 (navigation target for "Ver mais")
- **ST3** depends on T4 (data) and ST1 (lives inside announcements tab)
- **ST4** depends on T4 (data) and ST1 (lives inside announcements tab)
- **ST3 and ST4** can be done in parallel once ST1 is ready
- **ST2** can be done in parallel with ST3/ST4

## Shared Components Opportunity

If manager screens (T6, T8) are implemented first, consider extracting shared components:

| Component | Used by |
|-----------|---------|
| AnnouncementCard (list item) | Manager list (T6), Student list (ST3), Instructor list (IT3), Home feed (ST2, IT2) |
| AnnouncementFeedCard (compact home variant) | Student home (ST2), Instructor home (IT2) |
| AnnouncementDetailView (content body) | Manager detail (T8), Student detail (ST4), Instructor detail (IT4) |

Extracting these to `apps/mobile/components/announcements/` would avoid code duplication across roles.

## Status

| Task | Status | Files Changed |
|------|--------|---------------|
| ST1 | Complete | `apps/mobile/app/(app)/(student)/_layout.tsx`, `(announcements)/_layout.tsx` |
| ST2 | Complete | `apps/mobile/app/(app)/(student)/(home)/index.tsx` |
| ST3 | Complete | `apps/mobile/app/(app)/(student)/(announcements)/index.tsx` |
| ST4 | Complete | `apps/mobile/app/(app)/(student)/(announcements)/[id].tsx` |
