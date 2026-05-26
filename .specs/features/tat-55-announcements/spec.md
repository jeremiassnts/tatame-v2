# TAT-55 — Academy Announcements (Manager Phase)

Linear: https://linear.app/tatame/issue/TAT-55/academy-news-announcements-feed
Milestone: v2.1.1

## Overview

A dedicated announcements feed where managers can publish news to the academy. This phase covers manager CRUD and **read-only viewing for students**. Interactions (likes) will be a separate task.

## Design References (Pencil)

| Screen | Node ID | Description |
|--------|---------|-------------|
| Dashboard | EHJQg | "Ver avisos" quick action card on manager home |
| More menu | aeWY8 | New 5th tab "Mais" with menu: Avisos, Solicitacoes, Notificacoes |
| Announcements list | hNUpB | List with date, title, preview; FAB to create; count header |
| Create/Edit | mImIX | Form: cover image (optional), title, body text, publish button |
| Detail | XtbIe | Full announcement with image, date, author, edit/delete actions |

## Requirements

### R1: Data Model

- **R1.1** `announcements` table: id, academyId, authorId, title (required), body (required), imageUrl (optional), createdAt, updatedAt
- **R1.2** Sorted by most recent first (createdAt DESC)

### R2: Navigation — "Mais" Tab

- **R2.1** Add 5th bottom tab "Mais" to manager layout (icon: menu/ellipsis)
- **R2.2** "Mais" screen shows profile card (avatar + name + "Ver perfil") and menu items:
  - Avisos — "Crie e gerencie avisos" (navigates to announcements list)
  - Solicitacoes pendentes — shows count badge (existing screen)
  - Notificacoes — "Gerencie suas notificacoes" (existing screen)
  - Sair da conta (logout)
- **R2.3** Existing hidden tabs (create-notification) remain accessible programmatically

### R3: Dashboard Quick Action

- **R3.1** Add "Ver avisos" card to dashboard quick actions grid
- **R3.2** Tapping navigates to the announcements list screen

### R4: Announcements List Screen

- **R4.1** Header: back arrow + "Avisos" title
- **R4.2** Subtitle: "{n} avisos publicados" count
- **R4.3** Cards: date (DD mon YYYY), title (bold), body preview (truncated ~2 lines)
- **R4.4** FAB button (purple, "+") to navigate to create screen
- **R4.5** Tapping a card navigates to detail screen
- **R4.6** Pull-to-refresh support

### R5: Create & Edit Announcement

- **R5.1** Header: back arrow + "Novo aviso" (create) or "Editar aviso" (edit)
- **R5.2** Cover image area: tap to pick image, optional, uses existing upload service
- **R5.3** Title input (required)
- **R5.4** Body text input (required, multiline)
- **R5.5** Submit button: "Publicar aviso" (create) or "Salvar alteracoes" (edit)
- **R5.6** On success: navigate back to list, invalidate query cache

### R6: Announcement Detail

- **R6.1** Header: back arrow + "Detalhes do aviso" + edit icon (pencil)
- **R6.2** Cover image (if present), date, author name
- **R6.3** Title + full body text
- **R6.4** Edit icon navigates to edit screen (pre-filled form)
- **R6.5** "Excluir aviso" button at bottom — confirmation dialog before deletion
- **R6.6** On delete: navigate back to list, invalidate cache

### R7: API Endpoints

- **R7.1** `POST /announcements` — create (manager only)
- **R7.2** `GET /announcements` — list by academy (paginated, cursor-based)
- **R7.3** `GET /announcements/:id` — detail
- **R7.4** `PUT /announcements/:id` — update (manager only, own academy)
- **R7.5** `DELETE /announcements/:id` — delete (manager only, own academy)
- **R7.6** All endpoints require session + active academy context

### R8: Student Read-Only Viewing

- **R8.1** Students see announcements from their academy (reuses `GET /announcements` and `GET /announcements/:id`)
- **R8.2** Students access announcements via their own navigation (exact screen placement TBD by design)
- **R8.3** Students see the same list and detail views but without create/edit/delete actions
- **R8.4** No FAB button, no edit icon, no delete button for students

## Out of Scope (Separate Tasks)

- Like/comment interactions (TAT-114)
- Push notifications for new announcements
- In-app badges for unread announcements
