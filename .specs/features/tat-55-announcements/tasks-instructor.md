# TAT-55 — Academy Announcements (Instructor): Task Breakdown

Linear: https://linear.app/tatame/issue/TAT-55
Spec: [spec.md](spec.md) (R8: Student Read-Only Viewing — applies equally to instructors)
Design References: Node IDs 1XnFb (home), RRUuC (list), E7j7f (detail)
Note: Designs are shared with the student role. Instructor experience is identical (read-only).

## Dependencies on Manager Phase

These tasks depend on shared infrastructure from the manager phase (tasks.md):

| Task | What | Status |
|------|------|--------|
| T1 | DB schema — announcements table | Required |
| T2 | Validator schemas | Required |
| T3 | API module — announcement CRUD | Required |
| T4 | Mobile hooks — useAnnouncements | Required |

All instructor tasks below require T4 to be complete (hooks provide data access).

## Reusable Existing Code

| What | Where |
|------|-------|
| Instructor tab layout | `apps/mobile/app/(app)/(instructor)/_layout.tsx` |
| Instructor home screen | `apps/mobile/app/(app)/(instructor)/(home)/index.tsx` |
| `useAnnouncements()` hooks (from T4) | `apps/mobile/lib/hooks/use-announcements.ts` |
| `useCurrentUser()`, `useAcademyContext()` | `apps/mobile/lib/hooks/` |
| Academy card / sections pattern | `apps/mobile/app/(app)/(instructor)/(home)/index.tsx` |
| Student announcements screens (reference) | `apps/mobile/app/(app)/(student)/(announcements)/` |
| Shared announcement components (if extracted) | `apps/mobile/components/announcements/` |

## Tasks

### IT1: Add "Avisos" tab to instructor bottom navigation [Mobile — Navigation]

- **What:** Add a dedicated "Avisos" tab to the instructor bottom tab bar
- **Where:** `apps/mobile/app/(app)/(instructor)/_layout.tsx`
- **Depends on:** Nothing (navigation structure only)
- **Details:**
  - Current instructor tabs: (home) Inicio, (classes) Aulas, (members) Membros
  - Add new tab: `(announcements)` — icon: `Megaphone` (lucide), title: "Avisos"
  - Position: 3rd tab (after Aulas, before Membros) — matching the student tab order
  - Create stack layout: `apps/mobile/app/(app)/(instructor)/(announcements)/_layout.tsx`
  - Tab styling: same as existing (active: `#A078E8`, inactive: `#ABABAB`)
- **Done when:** "Avisos" tab appears in instructor bottom nav, navigates to announcements stack
- **Tests:** Manual navigation test
- **Gate:** App builds without errors

### IT2: Add "Ultimos avisos" section to instructor home screen [Mobile]

- **What:** Add an announcements preview section to the instructor home/dashboard
- **Where:** `apps/mobile/app/(app)/(instructor)/(home)/index.tsx`
- **Depends on:** T4 (hooks), IT1 (navigation target for "Ver mais")
- **Details:**
  - Design reference: node 1XnFb, "Announcements Section" (same layout as student)
  - Section header row: "Ultimos avisos" (Sora 16 bold white) + "Ver mais" link (Inter 13 medium, #A078E8)
  - "Ver mais" navigates to announcements list (IT3 screen via AVISOS tab)
  - Feed cards (up to 3 most recent):
    - Left: megaphone icon in purple tinted circle (38x38, #A078E820 bg, #A078E8 icon)
    - Center: title (Inter 14 semibold white) + preview (Inter 12, #8A8A8A, single line with date prefix "DD mmm ·")
    - Right: chevron-right icon (#525252, 16x16)
    - Card: rounded 14, bg #1A1A1A, border #2A2A2A 1px, padding 14, gap 12
  - Tapping a card navigates to announcement detail (IT4)
  - Use `useAnnouncements(academyId)` hook, take first 3 items
  - Hide section entirely if no announcements exist
  - Position: below "Aulas de hoje na academia" section (after existing graduation card and classes)
  - If shared `AnnouncementFeedCard` component was extracted in student tasks, reuse it here
- **Done when:** Home screen shows latest 3 announcements with correct styling, tapping navigates to detail
- **Tests:** Manual test
- **Gate:** App builds without errors

### IT3: Instructor announcements list screen [Mobile]

- **What:** Build read-only announcements list screen for instructors
- **Where:** `apps/mobile/app/(app)/(instructor)/(announcements)/index.tsx` (new file)
- **Depends on:** T4 (hooks), IT1 (navigation)
- **Details:**
  - Design reference: node RRUuC (same layout as student list)
  - Header: back arrow + "Avisos" title (centered)
  - Subtitle: "{n} avisos publicados" (muted text below header)
  - FlatList of announcement cards:
    - Date: "DD mmm YYYY" format (Portuguese abbreviated month, e.g. "15 mai 2026")
    - Title (bold, white)
    - Body preview (muted #8A8A8A, truncated ~2 lines)
    - Card: dark background (#1A1A1A or $--bg-card), rounded corners, subtle border
  - NO FAB button (instructors cannot create announcements)
  - Pull-to-refresh via RefreshControl
  - Infinite scroll via onEndReached (cursor-based pagination from useAnnouncements)
  - Empty state when no announcements
  - Tapping card navigates to detail screen (IT4) with announcement ID
  - If shared `AnnouncementCard` component was extracted in student tasks, reuse it directly
- **Done when:** List renders academy announcements, pagination works, cards navigate to detail
- **Tests:** Manual test
- **Gate:** App builds without errors

### IT4: Instructor announcement detail screen [Mobile]

- **What:** Build read-only announcement detail screen for instructors
- **Where:** `apps/mobile/app/(app)/(instructor)/(announcements)/[id].tsx` (new file)
- **Depends on:** T4 (hooks), IT1 (navigation)
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
  - If shared `AnnouncementDetailView` component was extracted in student tasks, reuse it directly
- **Done when:** Detail displays announcement correctly, completely read-only (no edit/delete actions)
- **Tests:** Manual test
- **Gate:** App builds without errors

## Execution Order

```
[Manager T1-T4 must be complete first]
[Student tasks recommended first (to extract shared components)]
        |
        v
IT1 ─────────────┐
        |         |
        v         v
IT2 ──> IT3 ──> IT4
```

- **IT1** can start immediately (navigation only)
- **IT2** depends on T4 (data) and IT1 (navigation target)
- **IT3** depends on T4 (data) and IT1 (lives inside announcements tab)
- **IT4** depends on T4 (data) and IT1 (lives inside announcements tab)
- **IT3 and IT4** can be done in parallel once IT1 is ready
- **IT2** can be done in parallel with IT3/IT4

## Implementation Strategy: Shared Components

Since instructor and student screens are **identical** (both read-only), the recommended implementation order is:

1. Implement student tasks (ST1-ST4) first
2. During ST3/ST4, extract shared components to `apps/mobile/components/announcements/`:
   - `AnnouncementFeedCard.tsx` — compact card for home feed
   - `AnnouncementListCard.tsx` — full card for list screen
   - `AnnouncementDetailContent.tsx` — detail body (image + metadata + title + body)
3. Instructor tasks (IT1-IT4) then become thin wrappers around shared components
   - IT1: tab setup only (unique per role)
   - IT2: import `AnnouncementFeedCard` + section header
   - IT3: import `AnnouncementListCard` + FlatList shell
   - IT4: import `AnnouncementDetailContent` + screen shell

This minimizes code duplication and makes future role additions trivial.

## Status

| Task | Status | Files Changed |
|------|--------|---------------|
| IT1 | Complete | `apps/mobile/app/(app)/(instructor)/_layout.tsx`, `(announcements)/_layout.tsx` |
| IT2 | Complete | `apps/mobile/app/(app)/(instructor)/(home)/index.tsx` |
| IT3 | Complete | `apps/mobile/app/(app)/(instructor)/(announcements)/index.tsx` |
| IT4 | Complete | `apps/mobile/app/(app)/(instructor)/(announcements)/[id].tsx` |
