# Design — Daily platform summary email (TAT-116)

## Shape

```
platform-summary.queue.ts     repeatable job "daily-summary" @ 0 10 * * *
        │
        ▼
platform-summary.worker.ts    resolves reference date, builds the service
        │
        ▼
PlatformSummaryService        one collectDay() per window (D-1, D-2), assembles
        │                     the report, applies fee math, computes deltas
        ├── IPlatformSummaryRepository  ──► Postgres impl (aggregate SQL)
        │                               └─► in-memory impl (unit tests)
        └── EmailService.sendDailyPlatformSummary()
                  │
                  ▼
            email queue ──► email.worker ──► DailyPlatformSummary template ──► Resend
```

Nothing new in the DB. The service never touches `Date` on its own — the worker
hands it a reference date string, everything else derives from it (BEH-03), which
is also what makes the unit tests deterministic.

## Day windows

BRT is UTC−3 with no DST since 2019. A BRT calendar day `YYYY-MM-DD` is the
half-open UTC interval `[YYYY-MM-DDT03:00:00Z, YYYY-MM-(DD+1)T03:00:00Z)`.

`timestamptz` columns (`payments.paid_at`, `users.created_at`,
`academy_memberships.created_at`, …) are filtered on that interval.
`checkins.date` is a plain `date` written from the check-in's own local day and is
compared to the date string directly — no conversion.

## Fee math

Lives in `@tatame/config` so the email and any future payout screen agree:

```ts
CARD_FEE_PERCENT_BPS = 399       // 3.99%
CARD_FEE_FIXED_CENTS = 39        // R$ 0,39
PIX_FEE_CENTS        = 80        // R$ 0,80

processorFeeCents(method, amountCents)
  stripe → Math.round(amountCents * 399 / 10_000) + 39
  pix    → 80
  manual → 0
```

Integer cents throughout; `Math.round` once, at the percentage. `manual` payments
are cash the academy took directly — no processor touched them, so no fee and they
are excluded from "to transfer" (PAY-04).

## Repository split

One method per aggregate, each a single grouped query, mirroring
`PostgresAdminRepository`. Day-scoped methods take a `DayWindow`; snapshot methods
take none. The service calls the day-scoped set twice and the snapshot set once.

Day-scoped (called for D-1 and D-2):
`newStudentsPerAcademy` · `paymentsPerAcademy` (grouped by method) ·
`unpaidPixPerAcademy` · `newSubscriptionsPerAcademy` · `canceledSubscriptionsPerAcademy` ·
`checkinsPerAcademy` · `topClassesPerAcademy` · `countNewUsers` · `listNewAcademies` ·
`countNewProSubscriptions`

Snapshot (called once):
`listAcademies` · `activeStudentsPerAcademy` · `overdueStudentsPerAcademy` ·
`pendingTransfersPerAcademy` · `activeSubscriptionsPerAcademy` ·
`expiringSubscriptionsPerAcademy` · `countManagerSubscriptions` · `platformTotals`

Only the fields the email prints are selected. Each returns a flat array keyed by
`academyId`; the service indexes them into a `Map` once and walks the academy list.

## Deltas

Only day-scoped numbers can have one. The report carries `{ value, previous }` for
new students, gross revenue and check-ins per academy, and for new users and gross
revenue platform-wide. The template renders the difference; the service does not
format.

## Template

`DailyPlatformSummary` takes the fully-computed report as props — no `Date`, no
cents-to-reais conversion inside the component beyond a local `formatBRL` helper,
because React Email props must survive a JSON round-trip through BullMQ. Numbers go
over the wire as integers and strings, never as `Date` objects.

## Why a dedicated queue

`engagement` is student-facing push notifications. Putting an owner report there
would make the Bull Board row lie about what failed. A `platform-summary` queue is
~20 lines and copies `engagement.queue.ts` exactly.
