# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When a shared component takes a variant prop that maps to styling, assert the output of every variant value, not only the default one
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-components` · harmful: 0
- features: tat-176-public-invite-page
- evidence: apps/web/components/store-buttons.tsx:9 (web-components)
- last seen: 2026-10-08T21:45:35Z

### L-002 - Prove that a page renders a shared component by rendering the page, not by asserting the component name appears in the page source
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `web-pages` · harmful: 0
- features: tat-176-public-invite-page
- evidence: C13 (web-pages)
- last seen: 2026-10-08T21:45:39Z

### L-003 - A one-comparison predicate is still a decision: classifying isDownloadLink as instrumentation left its query-string strip with no proof, and deleting it kept the whole suite green
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `apps/mobile` · harmful: 0
- features: tat-177-universal-links
- evidence: apps/mobile/lib/invite-link.ts:111 (apps/mobile)
- last seen: 2026-10-09T14:46:33Z

### L-004 - When one function refuses several bad inputs, name which guard refuses each: C14's five inputs all died in new URL or the segment guard, leaving the decodeURIComponent catch unproven
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `apps/mobile` · harmful: 0
- features: tat-177-universal-links
- evidence: C14 / apps/mobile/lib/invite-link.ts:91 (apps/mobile)
- last seen: 2026-10-09T14:46:33Z

### L-005 - A criterion forbidding two string literals from co-occurring in a package is unsatisfiable, because the test that asserts the mapping must write both; claim the single module instead
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `plan` · harmful: 0
- features: tat-177-universal-links
- evidence: AC 26 (plan)
- last seen: 2026-10-09T14:46:33Z

### L-006 - Check the premise before writing down a reason for declining a verifier sharpening: the claim that gitignore missed apps/mobile/ios was false and round 2 caught it
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `verification` · harmful: 0
- features: tat-177-universal-links
- evidence: .gitignore:12 (verification)
- last seen: 2026-10-09T14:46:33Z

### L-007 - Give every one-way door in the plan a check of its own, including a door discovered during the build after the checks were frozen
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `planning` · harmful: 0
- features: tat-191-pending-invite
- evidence: .specs/features/tat-191-pending-invite/plan.md Landing door 6 (planning)
- last seen: 2026-10-09T16:18:26Z

### L-008 - Never count pnpm lint or pnpm typecheck as a proof for apps/mobile: both scripts are echo stubs, so only its vitest files gate it
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `mobile` · harmful: 0
- features: tat-191-pending-invite
- evidence: apps/mobile/package.json:10 (mobile)
- last seen: 2026-10-09T16:18:26Z

### L-009 - Assert the destination a success path navigates to, not only the absence of the destination it replaced
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `mobile` · harmful: 0
- features: tat-191-pending-invite
- evidence: apps/mobile/lib/membership-errors.test.ts:132 (mobile)
- last seen: 2026-10-09T16:18:26Z

### L-010 - A source-text assertion must match the bare token across every source directory its criterion names, not a quoted form under some of them
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `mobile` · harmful: 0
- features: tat-191-pending-invite
- evidence: apps/mobile/lib/invite-copy.test.ts:79 (mobile)
- last seen: 2026-10-09T16:18:26Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
