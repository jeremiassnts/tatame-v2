# Feature: Daily platform summary email (TAT-116)

**Status:** Specified
**Linear:** [TAT-116](https://linear.app/tatame/issue/TAT-116/daily-platform-summary-email-cron-job)
**Branch:** `jeremiassnts3/tat-116-daily-platform-summary-email-cron-job`
**Size:** Large — new module + repository + email template + cron wiring

## Problem Statement

The platform owner has no daily read on what the business did. The admin panel
answers questions one at a time, on demand, for one academy at a time — and only
if someone remembers to open it. There is no artifact that says "yesterday, across
every academy: this much money moved, these many people showed up, these accounts
are in trouble."

The data already exists. `PostgresAdminRepository` proves most of the aggregations
are one query each. What is missing is a scheduled job that runs them together and
mails the result.

## Goals

- [ ] One email per day, at 07:00 BRT, to the platform owner, covering the **previous
      full BRT day**, broken down per academy plus a platform-wide section.
- [ ] Money is reported honestly at three levels: gross collected, processor fee,
      net owed to the manager.
- [ ] Every day-scoped number carries its delta against the day before.
- [ ] The job is re-runnable for an arbitrary past date, so a missed day can be
      recovered without code changes.
- [ ] No new tables, no new columns.

## Out of Scope

| Item | Reason |
| --- | --- |
| Weekly digest | User deferred it. The window is already a parameter, so it is a second `repeat` entry later, not a redesign |
| Anomaly highlighting ("Academy X had 0 check-ins") | User deferred it. The raw numbers are in the email; the reader can see a zero |
| Persisting processor fees on `payments` | Fees are derived from published rates (see FEE-01). AbacatePay sends `fee` on the webhook and we drop it — storing it is its own task |
| A Tatame commission on student payments | There is none. The product charges the manager a Pro subscription, nothing else |
| Failed Stripe card payments | Not persisted anywhere. Only unpaid Pix QR codes are recoverable from the DB |
| Recipient configurability beyond one address | `ADMIN_EMAIL` is the single owner address |

---

## Decisions taken with the user

**FEE-01 — There is no platform fee on student payments.**
The plan-creation screen (`apps/mobile/app/(app)/(manager)/(finances)/plans/create.tsx:248-254`)
states the rates to managers: card **3,99% + R$0,39** per transaction, Pix **R$0,80**
per transaction, *charged by the payment processor, not by Tatame*. So the email's
money section is `bruto − taxa do processador = líquido a repassar`, and "platform
revenue" means manager Pro subscriptions, not a cut of mensalidades.

The rates move to `@tatame/config` constants so the computation has one source.
The mobile copy stays prose — it is not re-derived from the constants in this task.

**SCOPE-01 — Of the three "nice to have" items, only the previous-day comparison ships.**

**DEST-01 — Recipient is the existing `ADMIN_EMAIL`.** When it is unset (or
`RESEND_API_KEY` is unset), the job logs and returns without sending — same posture
as every other email path.

## Assumption stated, not asked

**WINDOW-01 — "Today" means the previous full BRT day.**
The task says "today" and "7:00 AM BRT". At 07:00 almost nothing has happened today,
so a summary of "today" would be near-empty by construction. The report therefore
covers D-1 (00:00:00 → 23:59:59 BRT) and compares against D-2. The job accepts an
optional `{ date: "YYYY-MM-DD" }` payload naming the reference day, so any past day
can be re-sent.

---

## Requirements

### Scheduling

| ID | Requirement |
| --- | --- |
| SCHED-01 | A BullMQ repeatable job `daily-summary` runs at `0 10 * * *` (10:00 UTC = 07:00 BRT) on a dedicated `platform-summary` queue, registered at boot exactly like `registerEngagementJobs` |
| SCHED-02 | The job resolves its reference day from `job.data.date` when present, else the BRT day before now |
| SCHED-03 | The queue appears in Bull Board alongside `email`, `notification` and `engagement` |
| SCHED-04 | Worker and queue are closed on `SIGTERM`/`SIGINT` with the others |

### Data — per academy

| ID | Requirement |
| --- | --- |
| ACAD-01 | Every academy appears in the email, including ones with a fully empty day |
| USR-01 | New students on the reference day (`academy_memberships.joined_at`, role `student`), with delta vs D-2. `joined_at` rather than `created_at`: a membership row exists from the moment someone *requests* to join, and a pending request is not yet a student |
| USR-02 | Active students (`status = 'active'`) — a snapshot, no delta |
| USR-03 | Students overdue: active student subscriptions with no payment whose `reference_month` is the current month |
| PAY-01 | Payments received on the reference day: count and gross total, with gross delta vs D-2 |
| PAY-02 | The same broken down by method (`pix`, `stripe`, `manual`) |
| PAY-03 | Pix QR codes generated on the reference day with no payment recorded against them — count and amount |
| PAY-04 | Amount owed to the manager: untransferred `pix`/`stripe` payments as gross, processor fee, net. `manual` never passes through the platform and is excluded |
| FEE-01 | Processor fee per payment: `stripe` → `round(amount × 0.0399) + 39`; `pix` → `80`; `manual` → `0` |
| SUB-01 | Student subscriptions created on the reference day |
| SUB-02 | Active subscriptions expiring within the next 7 days |
| SUB-03 | Subscriptions canceled on the reference day |
| SUB-04 | Active subscription count |
| CHK-01 | Check-ins on the reference day, with delta vs D-2 |
| CHK-02 | The three most attended classes on the reference day, by name |

### Data — platform-wide

| ID | Requirement |
| --- | --- |
| PLAT-01 | Gross, fee and net across every academy for the reference day |
| PLAT-02 | Total outstanding amount owed to managers (gross / fee / net) |
| PLAT-03 | New users platform-wide on the reference day, with delta |
| PLAT-04 | Academies created on the reference day, listed by name |
| PLAT-05 | Manager subscriptions: active Pro count, Free count, and new Pro activations on the reference day — this is Tatame's own revenue line (see FEE-01) |
| PLAT-06 | Running totals: users, academies, gross collected all-time |

### Email

| ID | Requirement |
| --- | --- |
| MAIL-01 | A React Email template `DailyPlatformSummary` in `@tatame/email`, built on the existing `Layout`, scannable: platform block first, then one block per academy |
| MAIL-02 | Content in pt-BR, money as `R$ 1.234,56`, deltas as `+3` / `−2` / `—` when zero |
| MAIL-03 | Subject carries the reference date: `Resumo diário Tatame — 11/09/2026` |
| MAIL-04 | Delivered through the existing `email` queue and `EmailService`, not by calling Resend directly |
| MAIL-05 | Job id `daily-summary-<date>` so a re-run of the same day is deduplicated by BullMQ |

### Behaviour

| ID | Requirement |
| --- | --- |
| BEH-01 | `ADMIN_EMAIL` unset → the job logs at info and returns without enqueuing |
| BEH-02 | Zero academies → the platform block still sends |
| BEH-03 | All numbers derive from one reference date; no method calls `new Date()` on its own |

## Acceptance Criteria

- Boot with `REDIS_URL` set registers the repeatable job; Bull Board lists the queue.
- Running the job for a seeded date produces an email whose per-academy gross equals
  the sum of that academy's payments in the BRT day window, and whose net equals
  gross minus the FEE-01 fee.
- Unit tests cover the service against an in-memory repository: fee math, delta math,
  empty academy, missing `ADMIN_EMAIL`.
- `pnpm --filter @tatame/api typecheck`, `lint` and `test:unit` pass.
