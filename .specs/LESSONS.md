# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Assert both ends of a time-window predicate with their own excluded case, not one row inside the window
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `repo-layer` · harmful: 0
- features: tat-187-remove-abacatepay-rail
- evidence: apps/api/src/modules/platform-summary/platform-summary.repository.postgres.ts:250 (fault F1) (repo-layer)
- last seen: 2026-10-08T17:02:29Z

### L-002 - Recompute a predicate coverage row from the query the code builds, and give every predicate its own excluded case
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `repo-layer` · harmful: 0
- features: tat-187-remove-abacatepay-rail
- evidence: checks.md Coverage row: unpaidPixPerAcademy predicates (4) (repo-layer)
- last seen: 2026-10-08T17:02:34Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
