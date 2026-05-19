# TAT-55 — Academy Announcements (Manager): Task Breakdown

Linear: https://linear.app/tatame/issue/TAT-55
Spec: [spec.md](spec.md)

## Reusable Existing Code

| What | Where |
|------|-------|
| Upload service (R2, image upload) | `apps/api/src/modules/upload/upload.service.ts` |
| `useUploadImage()` hook | `apps/mobile/lib/hooks/use-upload.ts` |
| Manager tab layout pattern | `apps/mobile/app/(app)/(manager)/_layout.tsx` |
| Dashboard quick actions pattern | `apps/mobile/app/(app)/(manager)/(home)/index.tsx` |
| CRUD module pattern (routes/service/repo) | `apps/api/src/modules/notification/` |
| React Query hook patterns | `apps/mobile/lib/hooks/use-notifications.ts` |
| `requireSession`, `authorize`, `attachActiveAcademyContext` | `apps/api/src/middleware/` |
| `validateBody` middleware | `apps/api/src/middleware/` |
| Existing `useCurrentUser()`, `useAcademyContext()` | `apps/mobile/lib/hooks/` |

## Tasks

### T1: DB schema — announcements table [DB]

- **What:** Add `announcements` table to Drizzle schema and generate migration
- **Where:** `packages/db/src/schema/index.ts`
- **Depends on:** Nothing
- **Details:**
  - `announcements`: id (uuid PK), academyId (FK academies), authorId (FK users), title (text, not null), body (text, not null), imageUrl (text, nullable), createdAt, updatedAt
  - Index: `(academyId, createdAt DESC)` for list queries
  - Run `pnpm db:generate` to create migration SQL
- **Done when:** Table exists in schema, migration generated, typecheck passes
- **Tests:** None (schema only)
- **Gate:** `pnpm turbo run typecheck`

### T2: Validator schemas for announcements [Validators]

- **What:** Create Zod schemas for create/update announcement payloads
- **Where:** `packages/validators/src/announcement.schema.ts` (new file)
- **Depends on:** Nothing
- **Details:**
  - `createAnnouncementBodySchema`: title (string, min 1, max 200), body (string, min 1, max 5000), imageUrl (string url, optional)
  - `updateAnnouncementBodySchema`: same fields, all optional (partial)
  - Export from package index
- **Done when:** Schemas validate correct/incorrect payloads
- **Tests:** Unit test for schema validation
- **Gate:** `pnpm turbo run typecheck`

### T3: API module — announcement CRUD [API]

- **What:** Create announcement module with routes, service, and repository following existing patterns
- **Where:** `apps/api/src/modules/announcement/` (new directory)
- **Depends on:** T1, T2
- **Details:**
  - **Repository** (`announcement.repository.postgres.ts`):
    - `create(data)` — insert and return announcement
    - `findById(id)` — single announcement with author name (join users)
    - `findByAcademy(academyId, cursor?, limit=20)` — paginated list, createdAt DESC, with author name
    - `countByAcademy(academyId)` — total count for header
    - `update(id, data)` — partial update
    - `delete(id)` — hard delete
  - **Service** (`announcement.service.ts`):
    - Thin layer calling repo methods
    - Validates announcement belongs to academy before update/delete
  - **Routes** (`announcement.routes.ts`):
    - `POST /` — `requireSession`, `authorize("manager")`, `attachActiveAcademyContext`, `validateBody(createAnnouncementBodySchema)`
    - `GET /` — `requireSession`, `attachActiveAcademyContext` (list)
    - `GET /:id` — `requireSession` (detail)
    - `PUT /:id` — `requireSession`, `authorize("manager")`, `attachActiveAcademyContext`, `validateBody(updateAnnouncementBodySchema)`
    - `DELETE /:id` — `requireSession`, `authorize("manager")`, `attachActiveAcademyContext`
  - Register in `apps/api/src/router.ts`: `apiRouter.use("/announcements", announcementRouter)`
- **Done when:** All 5 endpoints work correctly
- **Tests:** Unit tests for service layer
- **Gate:** `pnpm --filter @tatame/api test:unit`

### T4: Mobile hooks — useAnnouncements [Mobile]

- **What:** Create React Query hooks for announcements CRUD
- **Where:** `apps/mobile/lib/hooks/use-announcements.ts` (new file)
- **Depends on:** T3
- **Details:**
  - `useAnnouncements(academyId)` — infinite query, cursor-based pagination
  - `useAnnouncement(id)` — single announcement query
  - `useAnnouncementCount(academyId)` — count query
  - `useCreateAnnouncement()` — mutation, invalidates list on success
  - `useUpdateAnnouncement()` — mutation, invalidates list + detail on success
  - `useDeleteAnnouncement()` — mutation, invalidates list on success
  - Add API client methods in `apps/mobile/lib/api.ts`
  - Query keys: `["announcements", academyId]`, `["announcement", id]`, `["announcement-count", academyId]`
- **Done when:** Hooks compile, query keys properly invalidated
- **Tests:** None (hooks tested through screens)
- **Gate:** `pnpm turbo run typecheck`

### T5: "Mais" tab + menu screen [Mobile — Navigation]

- **What:** Add 5th "Mais" tab to manager bottom navigation with dedicated menu screen
- **Where:**
  - `apps/mobile/app/(app)/(manager)/_layout.tsx` (add tab)
  - `apps/mobile/app/(app)/(manager)/(more)/_layout.tsx` (new)
  - `apps/mobile/app/(app)/(manager)/(more)/index.tsx` (new — menu screen)
- **Depends on:** Nothing
- **Details:**
  - Add `(more)` tab group to `_layout.tsx` with icon `Menu` (lucide) or `Ellipsis`, title "Mais"
  - Menu screen (index.tsx) design from node aeWY8:
    - Profile card: user avatar (initials), name, "Ver perfil" link (navigates to settings or profile)
    - Menu items with icon + title + subtitle + chevron:
      - Avisos (Megaphone icon) — "Crie e gerencie avisos" → navigates to announcements list
      - Solicitacoes pendentes (UserCheck icon) — "{n} novas solicitacoes" → existing pending screen
      - Notificacoes (Bell icon) — "Gerencie suas notificacoes" → existing notifications screen
    - "Sair da conta" button (red, bottom) — calls Clerk signOut
  - Move `create-notification` hidden tab to remain accessible
- **Done when:** 5th tab visible, menu items navigate correctly
- **Tests:** Manual navigation test
- **Gate:** App builds without errors

### T6: Announcements list screen [Mobile]

- **What:** Build the announcements list screen matching design (node hNUpB)
- **Where:** `apps/mobile/app/(app)/(manager)/(more)/announcements.tsx` (new file)
- **Depends on:** T4, T5
- **Details:**
  - Header: back arrow + "Avisos" title
  - Subtitle text: "{n} avisos publicados"
  - FlatList of announcement cards:
    - Date formatted: "15 mai 2026" (DD mmm YYYY, Portuguese abbreviated month)
    - Title (bold, white)
    - Body preview (muted, truncated 2 lines)
    - Card background: dark card (#1A1A1A or similar), rounded corners
  - FAB button: absolute bottom-right, purple (#A078E8), "+" icon, navigates to create screen
  - Pull-to-refresh via RefreshControl
  - Infinite scroll via onEndReached
  - Empty state when no announcements
  - Tapping card navigates to detail screen with announcement ID
- **Done when:** List renders announcements, pagination works, FAB navigates to create
- **Tests:** Manual test
- **Gate:** App builds without errors

### T7: Create/Edit announcement screen [Mobile]

- **What:** Build the announcement form screen matching design (node mImIX)
- **Where:** `apps/mobile/app/(app)/(manager)/(more)/create-announcement.tsx` (new file)
- **Depends on:** T4, T5
- **Details:**
  - Route params: optional `announcementId` (if editing, pre-fill form)
  - Header: back arrow + "Novo aviso" or "Editar aviso"
  - Cover image section:
    - Placeholder with upload icon + "Toque para adicionar imagem"
    - Tap opens image picker (expo-image-picker)
    - On pick: upload via `useUploadImage()`, show preview
    - If editing with existing image: show current image with option to change
  - Title input: text input, placeholder "Ex. Horario especial de natal"
  - Body input: multiline TextInput, placeholder "Escreva o conteudo do aviso aqui..."
  - Submit button: full-width purple gradient, "Publicar aviso" or "Salvar alteracoes"
  - On submit: call create/update mutation, navigate back on success
  - Loading state on submit button
  - Use `react-hook-form` for form management
- **Done when:** Can create and edit announcements with optional image
- **Tests:** Manual test
- **Gate:** App builds without errors

### T8: Announcement detail screen [Mobile]

- **What:** Build the announcement detail screen matching design (node XtbIe)
- **Where:** `apps/mobile/app/(app)/(manager)/(more)/announcement/[id].tsx` (new file)
- **Depends on:** T4, T5
- **Details:**
  - Route params: `id` (announcement ID)
  - Header: back arrow + "Detalhes do aviso" + edit icon (pencil, top-right)
  - Content:
    - Cover image (if present, full-width)
    - Date (formatted) + author name (from API join)
    - Title (large, bold)
    - Body text (full)
  - Edit icon: navigates to create-announcement with `announcementId` param
  - "Excluir aviso" button: red/danger style, bottom of screen
    - Confirmation Alert before deletion
    - On confirm: call delete mutation, navigate back to list
  - Loading/error states
- **Done when:** Detail displays correctly, edit navigates to form, delete works with confirmation
- **Tests:** Manual test
- **Gate:** App builds without errors

### T9: Dashboard "Ver avisos" quick action [Mobile]

- **What:** Add "Ver avisos" card to manager dashboard quick actions
- **Where:** `apps/mobile/app/(app)/(manager)/(home)/index.tsx`
- **Depends on:** T6 (needs announcements screen to exist)
- **Details:**
  - Add card to quick actions grid (matching existing pattern: Solicitacoes, Agenda, Pagamentos)
  - Icon: Megaphone (lucide-react-native)
  - Title: "Ver avisos"
  - Tap navigates to `/(more)/announcements`
  - Position: 4th card in grid (after "Pagamentos pendentes", matching design)
- **Done when:** Card visible on dashboard, navigates to announcements list
- **Tests:** Manual test
- **Gate:** App builds without errors

### T10: Student announcements list screen [Mobile]

- **What:** Build read-only announcements list for students
- **Where:** `apps/mobile/app/(app)/(student)/announcements.tsx` (new file)
- **Depends on:** T4
- **Details:**
  - Reuses `useAnnouncements(academyId)` hook from T4
  - Same layout as manager list (T6): header, count subtitle, cards with date/title/preview
  - NO FAB button (students cannot create)
  - Tapping card navigates to student detail screen
  - Pull-to-refresh + infinite scroll
  - Navigation entry point: TBD by design (could be home shortcut or dedicated tab)
- **Done when:** Students see academy announcements in read-only list
- **Tests:** Manual test
- **Gate:** App builds without errors

### T11: Student announcement detail screen [Mobile]

- **What:** Build read-only announcement detail for students
- **Where:** `apps/mobile/app/(app)/(student)/announcement/[id].tsx` (new file)
- **Depends on:** T4
- **Details:**
  - Reuses `useAnnouncement(id)` hook from T4
  - Same layout as manager detail (T8): image, date, author, title, body
  - NO edit icon in header
  - NO "Excluir aviso" button
  - Read-only view only
- **Done when:** Students see full announcement detail without edit/delete actions
- **Tests:** Manual test
- **Gate:** App builds without errors

## Execution Order

```
T1 ──┐
T2 ──┼──> T3 ──> T4 ──┐
T5 ──────────────────┼──> T6
                       ├──> T7
                       ├──> T8
                       ├──> T9
                       ├──> T10
                       └──> T11
```

- **Parallel batch 1:** T1, T2, T5 (no dependencies)
- **Sequential:** T3 (depends on T1, T2)
- **Sequential:** T4 (depends on T3)
- **Parallel batch 2:** T6, T7, T8, T9, T10, T11 (all depend on T4; T6-T9 also on T5)

## Status

| Task | Status | Files Changed |
|------|--------|---------------|
| T1 | Complete | `packages/db/src/schema/index.ts`, `packages/db/drizzle/0014_announcements.sql` |
| T2 | Complete | `packages/validators/src/announcement.schema.ts` |
| T3 | Complete | `apps/api/src/modules/announcement/` (5 files), `apps/api/src/router.ts` |
| T4 | Complete | `apps/mobile/lib/hooks/use-announcements.ts` |
| T5 | Complete | `apps/mobile/app/(app)/(manager)/_layout.tsx`, `(more)/_layout.tsx`, `(more)/index.tsx` |
| T6 | Complete | `apps/mobile/app/(app)/(manager)/(more)/announcements.tsx` |
| T7 | Complete | `apps/mobile/app/(app)/(manager)/(more)/create-announcement.tsx` |
| T8 | Complete | `apps/mobile/app/(app)/(manager)/(more)/announcement/[id].tsx` |
| T9 | Complete | `apps/mobile/app/(app)/(manager)/(home)/index.tsx` |
| T10 | Complete | `apps/mobile/app/(app)/(student)/(announcements)/index.tsx` |
| T11 | Complete | `apps/mobile/app/(app)/(student)/(announcements)/[id].tsx` |
