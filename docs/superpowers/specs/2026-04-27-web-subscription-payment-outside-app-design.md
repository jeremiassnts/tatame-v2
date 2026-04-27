# Manager Subscription: Payment Outside App (Stripe Web)

**Date:** 2026-04-27
**Status:** Approved
**Branch:** feature/web-subscription

## Problem

Apple App Store keeps rejecting the app due to in-app payment configuration for the manager subscription (RevenueCat/IAP). The process involves excessive bureaucracy, forms, and a 30% revenue cut.

## Decision

Move manager subscription payment entirely outside the app. Managers sign up and pay via Stripe on the web. The app becomes 100% free with no in-app purchases. RevenueCat is fully removed.

## Flow Overview

```
Landing Page → /cadastro (create account) → Stripe Checkout → /assinatura-confirmada → Download App → Login → Create Academy → Home
```

## Detailed Flows

### New Manager Signup

1. Manager visits landing page (single plan: R$49/month, 30-day free trial)
2. Clicks CTA → redirected to `/cadastro`
3. Signup page has two states:
   - **Unauthenticated:** Shows social login (Google/Apple), email/password fields, name fields, and "Criar conta e assinar" button
   - **Authenticated:** After social login redirect returns, the auth section collapses to show `✓ Logado como joao@email.com`, button changes to "Ir para pagamento"
4. Via email: fills fields → "Criar conta e assinar" → creates Clerk account → Stripe Checkout (uses `clerkUserId` in metadata, no academy needed)
5. Via social: clicks Google/Apple → provider redirect → returns → authenticated state → "Ir para pagamento" → Stripe Checkout
6. Stripe webhook stores Stripe data as pending on user record (no academy yet)
7. Stripe Checkout redirects back to `/cadastro?checkout=session_id`
7. Button shows loading while API confirms payment via webhook
8. Success → redirect to `/assinatura-confirmada` (W-PUB-06)
9. Failure → error message on screen ("Pagamento nao foi concluido. Tente novamente.")
10. Confirmation page shows: email verification reminder, App Store/Google Play download links, next steps

### Manager Login in App

1. Manager opens app → logs in with same Clerk credentials
2. If no academy yet → create academy flow. On academy creation, API checks for pending Stripe subscription data on user and automatically links it to the new academy.
3. API checks Stripe subscription status
4. Active/trialing → normal flow (home)
5. Inactive/canceled/past_due → blocked screen with message to visit web portal and button that opens browser

### Manager Web Portal

1. Manager visits `/conta/login` → logs in (W-MGR-01)
2. Dashboard at `/conta` (W-MGR-02) — read-only financial summary
3. Subscription at `/conta/assinatura` (W-MGR-03) — manage plan, payment, cancel

## Web Routes

### Public (no auth)

| Route | Screen | Description |
|-------|--------|-------------|
| `/cadastro` | W-PUB-05 | Account creation + Stripe Checkout redirect |
| `/assinatura-confirmada` | W-PUB-06 | Post-payment success page |

### Manager Area (Clerk auth required)

| Route | Screen | Description |
|-------|--------|-------------|
| `/conta/login` | W-MGR-01 | Custom login page (email/password, Google, Apple) |
| `/conta` | W-MGR-02 | Financial dashboard (read-only summary) |
| `/conta/assinatura` | W-MGR-03 | Subscription management |

### Existing (unchanged)

| Route | Description |
|-------|-------------|
| `/` | Landing page (update pricing to single plan) |
| `/admin/*` | Admin panel (no changes) |

## Mobile App Changes

### Removed

- All RevenueCat integration (SDK, webhooks, client at `apps/mobile/lib/revenuecat.ts`)
- Plan selection screen (Free/Pro) from manager onboarding
- Manager account creation in-app (only instructor and student can sign up via app)
- In-app subscription management screen
- Free plan limits logic (`canCreateClass`, `canCreatePlan`, `canApproveStudent`, `canApproveInstructor`)

### Modified

- Manager onboarding: login → API validates active subscription → create academy → home
- Subscription inactive: show blocked screen with message and link to web portal (URL from env var)
- Financial screen: replace "Gerenciar assinatura" with "Gerenciar minha conta" button that opens web portal URL (from env var) in browser
- All features unlocked (no Free plan limits)

### Unchanged

- Login with Google/Apple/Email (Clerk)
- Instructor and student flows (signup, onboarding, everything)
- Student payments (Stripe/Pix/manual)

## Web Platform — Manager Portal

### Login (`/conta/login` — W-MGR-01)

- Custom login page (not Clerk's default)
- Email/password + Google + Apple login
- Desktop and mobile responsive versions designed

### Dashboard (`/conta` — W-MGR-02)

- Read-only financial summary from same API the app uses
- KPIs: Alunos Ativos, Receita Mensal, Check-ins, Inadimplencia
- Resumo do Mes (Recebido, Pendente, Atrasado)
- Receita por Plano (bar chart)
- Transacoes Recentes with pagination
- Sidebar navigation: Financeiro / Assinatura

### Subscription (`/conta/assinatura` — W-MGR-03)

- Current plan with status badge and price
- Next billing date / Subscriber since
- Payment method display with "Atualizar cartao" button
- "Dados de pagamento" button → redirects to Stripe Customer Portal
- Payment history table
- "Cancelar assinatura" → confirmation dialog → API cancels in Stripe

### Responsiveness

- Mobile responsive versions designed (W-MGR-01-M, W-MGR-02-M, W-MGR-03-M)
- Manager can access `/conta` from mobile browser

## Landing Page Changes

- Pricing section: update from 2 plans (Free R$0 + Pro R$49) to single plan (R$49/month)
- Highlight 30-day free trial and cancel-anytime messaging
- CTA links to `/cadastro`

## API Changes

### Removed

| Item | Path |
|------|------|
| RevenueCat client | `apps/api/src/modules/manager-subscription/revenuecat-client.ts` |
| RevenueCat webhook handler | Remove from manager-subscription module |
| Free plan limits | `canCreateClass`, `canCreatePlan`, `canApproveStudent`, `canApproveInstructor` |
| RevenueCat env vars | `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_SECRET` |

### Modified

| Item | Change |
|------|--------|
| `manager-subscription` module | Rewrite: replace RevenueCat with Stripe Subscriptions |
| `managerSubscriptions` table | Replace RevenueCat fields with Stripe fields |
| `authorize` middleware | Add subscription status check for manager role |

### New

| Item | Description |
|------|-------------|
| Stripe subscription integration | Create subscription with 30-day trial via Stripe API |
| Stripe webhook handler | Handle subscription lifecycle events |
| Manager subscription API routes | Endpoints for web portal (get status, cancel, etc.) |

### Subscription Linking Strategy

The manager creates their account and pays on the web BEFORE creating an academy in the app. To handle this timing:

1. **Checkout:** Stripe Checkout session uses `clerkUserId` in metadata (not `academyId`)
2. **Webhook:** On payment confirmation, Stripe data (`stripeCustomerId`, `stripeSubscriptionId`) is stored on the `users` table as pending subscription data
3. **Academy creation:** When the manager creates their academy in the app, the API checks if the user has pending Stripe subscription data and creates the `managerSubscriptions` record linked to the new academy
4. **Subsequent operations:** Once linked, all subscription management goes through `managerSubscriptions` as before

### Database — `users` Table (new columns)

| Field | Type | Description |
|-------|------|-------------|
| `pendingStripeCustomerId` | string (nullable) | Stripe customer ID before academy creation |
| `pendingStripeSubscriptionId` | string (nullable) | Stripe subscription ID before academy creation |

These columns are cleared once the subscription is linked to an academy.

### Database — `managerSubscriptions` Table

Replace RevenueCat fields with:

| Field | Type | Description |
|-------|------|-------------|
| `stripeCustomerId` | string | Stripe customer ID |
| `stripeSubscriptionId` | string | Stripe subscription ID |
| `stripePriceId` | string | Stripe price ID |
| `status` | enum | active, past_due, canceled, incomplete, trialing |
| `trialEndsAt` | timestamp | Trial expiration date |
| `currentPeriodEnd` | timestamp | Current billing period end |

### Stripe Webhook Events

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Store Stripe data on user (pending) |
| `customer.subscription.updated` | Update status, period dates on managerSubscriptions (if linked) |
| `customer.subscription.deleted` | Mark as canceled |
| `invoice.payment_failed` | Update status to past_due |

### Env Vars

Web portal URL exposed to mobile via env var for the "Gerenciar minha conta" deep link.

## Design References (Pencil)

### Functional Screens (Desktop)

| Node ID | Screen |
|---------|--------|
| `Ac4D6` | W-MGR-01: Login |
| `CKUpC` | W-MGR-02: Financeiro |
| `xWgHI` | W-MGR-03: Assinatura |

### Functional Screens (Mobile Responsive)

| Node ID | Screen |
|---------|--------|
| `2ybiF` | W-MGR-01-M: Login (Mobile) |
| `xSgJc` | W-MGR-02-M: Financeiro (Mobile) |
| `NLX8F` | W-MGR-03-M: Assinatura (Mobile) |

### Onboarding Screens (Desktop)

| Node ID | Screen |
|---------|--------|
| `iAfIR` | W-PUB-05: Cadastro |
| `vfdqo` | W-PUB-06: Assinatura Confirmada |
