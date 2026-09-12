# Tasks — Daily platform summary email (TAT-116)

| # | Task | Depends on | Covers |
| --- | --- | --- | --- |
| 1 | Processor fee constants + `processorFeeCents()` in `@tatame/config` | — | FEE-01 |
| 2 | Report types + `IPlatformSummaryRepository` | — | all data reqs |
| 3 | `PostgresPlatformSummaryRepository` | 2 | USR-*, PAY-*, SUB-*, CHK-*, PLAT-* |
| 4 | `InMemoryPlatformSummaryRepository` | 2 | test support |
| 5 | `PlatformSummaryService` — windows, deltas, fee math, assembly | 1,2 | WINDOW-01, BEH-03, PAY-04 |
| 6 | `DailyPlatformSummary` React Email template + export | 2 | MAIL-01, MAIL-02 |
| 7 | Wire the template into `email.queue` / `email.worker` / `EmailService` | 6 | MAIL-03, MAIL-04, MAIL-05 |
| 8 | `platform-summary.queue.ts` + `platform-summary.worker.ts` | 5,7 | SCHED-01, SCHED-02 |
| 9 | Boot wiring in `server.ts` (worker, register, Bull Board, shutdown) | 8 | SCHED-03, SCHED-04 |
| 10 | Unit tests for the service | 4,5 | acceptance |
| 10b | Integration test for the Postgres queries (BRT windows, `NOT EXISTS` branches) | 3 | acceptance |
| 11 | Gate: typecheck + lint + unit tests across the workspace | 1-10b | acceptance |

**Gate command:** `pnpm --filter @tatame/config build && pnpm --filter @tatame/email build && pnpm --filter @tatame/api typecheck && pnpm --filter @tatame/api lint && pnpm --filter @tatame/api test:unit`

## Status

All tasks implemented and verified. `typecheck`, `lint`, `test:unit` (436 tests) and
`test:integration` (53 tests, 7 of them this feature's) all pass.
