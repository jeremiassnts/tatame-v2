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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
