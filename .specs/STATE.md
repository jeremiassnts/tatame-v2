# STATE

Project-level decisions and the session handoff for `tlc-spec-lean` work in this repository.

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | A screen that calls `POST /memberships/requests` shows the sentence from `apps/mobile/lib/membership-errors.ts`, never from `lib/api-error-message.ts#describeApiError` | `describeApiError` falls through to `error.detail`/`error.message` for any uncoded failure outside its 6-entry `TRANSLATED` allowlist, and all four membership failures are uncoded two-argument `HttpError`s - so it answers the API's English. It also structurally cannot see the `/users/me` membership that tells the two 409s apart. The two modules answer differently for 403, 409 and 404 and their consumers are disjoint today; `apps/mobile` has no lint and no typecheck, so nothing mechanical stops a future screen reaching for the wrong one out of habit | active | 2026-10-09 |

## Handoff

TAT-191 is complete on `jeremiassnts3/tat-191-carry-the-pending-invite-through-sign-up-and-onboarding-for`,
verified PASS at round 2, and not yet pushed. Three of TAT-175's four sub-issues have landed
(TAT-176 #29, TAT-177 #30, TAT-191); the remaining one is TAT-178.

Two things this feature found and deliberately left alone, both worth their own ticket:

- `apps/mobile`'s `lint` and `typecheck` scripts are both `echo` stubs, so nothing in CI checks any
  mobile file. Run by hand, `tsc --noEmit` reports 5 pre-existing errors. TAT-177 found the same
  and TAT-191 had to write source-text assertions (C16, C34, C43, C46) to cover what a typecheck
  would have caught for free.
- `app/(app)/index.tsx:57-58` renders `ApiError.message` - the API's English - on a profile-load
  failure. Pre-existing, outside TAT-191's criteria, untouched across the whole feature range.
