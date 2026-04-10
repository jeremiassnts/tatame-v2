# Admin Panel Design

Internal administration panel for platform-wide operational control: academies, subscribers, payments, and transfer management.

## Context

Student payments via app (Stripe/Pix) go to the platform owner's account. The owner then manually transfers funds to each academy's manager. There is currently no system to track these transfers. The admin panel solves this by providing visibility into all payments and a mechanism to record transfers.

This panel is used exclusively by the platform owner (single admin user).

## Authentication & Security

### Backend

- Env variables: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`
- `POST /v1/admin/login` — public endpoint, validates email/password against env vars, returns a signed JWT (HS256, 7-day expiry)
- `adminOnly` middleware on all other admin routes — validates JWT from `Authorization: Bearer <token>` header
- No Clerk dependency for admin auth

### Frontend

- Custom login form (email + password) at `/admin/login`
- On success, JWT stored in `localStorage`
- All admin API calls include the token via `Authorization` header
- On 401/403 response, token is cleared and user is redirected to login
- Logout clears `localStorage` and redirects to login

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
| POST | `/v1/admin/login` | Authenticate admin (public, no middleware) |
| GET | `/v1/admin/verify` | Check if token is valid |
| GET | `/v1/admin/dashboard` | Global KPIs: active subscribers, total users, total revenue (app), total transferred |
| GET | `/v1/admin/dashboard/checkins` | Daily check-ins for the last 7 days (line chart data) |
| GET | `/v1/admin/dashboard/financial-summary` | Financial summary: total transferred, total pending |
| GET | `/v1/admin/dashboard/academies` | Academy list with status, plan, student count, pending transfer amount |
| GET | `/v1/admin/academies/:id` | Academy detail: manager info, KPIs (students, revenue, transferred, pending) |
| GET | `/v1/admin/academies/:id/payments` | Academy payments with pagination, includes `transferredAt` |
| PATCH | `/v1/admin/payments/transfer` | Bulk transfer confirmation — receives array of payment IDs, sets `transferredAt = now()` |
| PATCH | `/v1/admin/payments/:id/transfer` | Individual transfer confirmation |

All routes except `/login` require `adminOnly` middleware.

## Frontend (Next.js Pages)

### Route Structure

```
apps/web/app/admin/
├── login/
│   └── page.tsx            → Login form (client component)
├── layout.tsx              → Minimal layout (metadata only)
└── (dashboard)/
    ├── layout.tsx          → Sidebar layout (Dashboard + Log out)
    ├── page.tsx            → Dashboard (/admin)
    └── academies/
        └── [id]/
            └── page.tsx    → Academy detail
```

### Login (`/admin/login`)

- Dark background (`#0C0C0C`), centered card with TATAME icon.png + "Painel Administrativo"
- Custom email/password form with show/hide password toggle
- Calls `POST /v1/admin/login`, stores JWT in localStorage

### Layout (`/admin/(dashboard)/layout.tsx`)

- Fixed sidebar (260px): TATAME icon.png, "Dashboard" nav item, "Sair" button (clears token)
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
