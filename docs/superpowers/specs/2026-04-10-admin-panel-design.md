# Admin Panel Design

Internal administration panel for platform-wide operational control: academies, subscribers, payments, and transfer management.

## Context

Student payments via app (Stripe/Pix) go to the platform owner's account. The owner then manually transfers funds to each academy's manager. There is currently no system to track these transfers. The admin panel solves this by providing visibility into all payments and a mechanism to record transfers.

This panel is used exclusively by the platform owner (single admin user).

## Authentication & Security

### Backend Middleware (`adminOnly`)

- New env variable: `ADMIN_EMAIL` in `packages/config/src/env.ts`
- Middleware extracts userId from Clerk JWT (same flow as existing `authorize`), fetches user email, compares against `ADMIN_EMAIL`
- Returns 403 if mismatch — no information about admin endpoints leaked
- All routes under `/v1/admin/*` use this middleware

### Frontend Middleware (Next.js)

- Route middleware checks if Clerk-authenticated user's email matches admin
- Redirects to `/admin/login` if not authenticated
- Shows access denied if authenticated but not admin
- Login screen uses Clerk's `<SignIn />` component with dark theme styling

### What Does NOT Change

- No changes to the existing role system (manager/instructor/student)
- No admin information exposed in existing user-facing APIs

## Data Model

### Changes to `payments` Table

New column:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `transferredAt` | `timestamp` | `null` | When the transfer to the manager was confirmed |

### Transfer Logic (Derived)

- `method = "manual"` (origin: "Manager") → transfer not applicable (manager already received the money directly)
- `method = "stripe" or "pix"` (origin: "App") → transfer pending if `transferredAt IS NULL`, transferred if set
- Confirming a transfer (individual or bulk) sets `transferredAt = now()` on selected payments
- Backend validates that only "App" origin payments can be marked as transferred

### Data Visibility

- `transferredAt` is NEVER returned in existing APIs (`/v1/payments/`, `/v1/payments/me`)
- Only `/v1/admin/*` routes have access to this field

## API (Backend Module)

New module: `apps/api/src/modules/admin/`

Follows existing pattern: `routes → service → repository`

### Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/v1/admin/dashboard` | Global KPIs: active subscribers, total users, total revenue (app), total transferred |
| GET | `/v1/admin/dashboard/checkins` | Daily check-ins for the last 7 days (line chart data) |
| GET | `/v1/admin/dashboard/financial-summary` | Financial summary: total transferred, total pending |
| GET | `/v1/admin/dashboard/academies` | Academy list with status, plan, student count, pending transfer amount |
| GET | `/v1/admin/academies/:id` | Academy detail: manager info, KPIs (students, revenue, transferred, pending) |
| GET | `/v1/admin/academies/:id/payments` | Academy payments with pagination, includes `transferredAt` |
| PATCH | `/v1/admin/payments/transfer` | Bulk transfer confirmation — receives array of payment IDs, sets `transferredAt = now()` |
| PATCH | `/v1/admin/payments/:id/transfer` | Individual transfer confirmation |

All routes require `adminOnly` middleware.

## Frontend (Next.js Pages)

### Route Structure

```
apps/web/app/admin/
├── login/              → Login screen (Clerk SignIn)
├── layout.tsx          → Sidebar layout (Dashboard + Log out)
├── page.tsx            → Dashboard (/admin)
└── academies/
    └── [id]/
        └── page.tsx    → Academy detail
```

### Login (`/admin/login`)

- Dark background (`#0C0C0C`), centered card with TATAME logo + "Painel Administrativo"
- Clerk `<SignIn />` component with dark theme
- Email/password only (no Google)

### Layout (`/admin/layout.tsx`)

- Fixed sidebar (260px): TATAME logo, "Dashboard" nav item, "Sair" at bottom
- Main content area with scroll
- Dark theme: background `#0C0C0C`, cards `#1A1A1A`, borders `#2A2A2A`, accent `#A078E8`

### Dashboard (`/admin`)

- 4 KPI cards: Active subscribers, Total users, Total revenue (app), Total transferred
- Line chart: daily check-ins (last 7 days) — using Recharts
- Financial summary: "Total Repassado" and "A Repassar" cards
- Academy table: name, status, plan, students, pending transfer amount — rows are clickable, navigate to detail

### Academy Detail (`/admin/academies/[id]`)

- Back button + academy name header
- Manager info card: name, email, phone, plan badge
- 4 KPI cards: Students, Monthly revenue, Already transferred, Pending transfer
- Payments table columns: checkbox, Student, Amount, Method, Origin (App/Manager), Transfer (date or "Pendente"), Status, Action
- Bulk action bar (appears on selection): "X selecionados - Total: R$ X" + "Confirmar Repasse" button
- Individual "Repassar" button per row (only for App origin with pending transfer)
