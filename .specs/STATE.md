# STATE

Project-level decisions and the session handoff for `tlc-spec-lean` work in this repository.

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | A screen that calls `POST /memberships/requests` shows the sentence from `apps/mobile/lib/membership-errors.ts`, never from `lib/api-error-message.ts#describeApiError` | `describeApiError` falls through to `error.detail`/`error.message` for any uncoded failure outside its 6-entry `TRANSLATED` allowlist, and all four membership failures are uncoded two-argument `HttpError`s - so it answers the API's English. It also structurally cannot see the `/users/me` membership that tells the two 409s apart. The two modules answer differently for 403, 409 and 404 and their consumers are disjoint today; `apps/mobile` has no lint and no typecheck, so nothing mechanical stops a future screen reaching for the wrong one out of habit | active | 2026-10-09 |

## Handoff

TAT-175's four sub-issues have all landed on
`jeremiassnts3/tat-175-let-managers-invite-new-members-with-a-shareable-smart`: TAT-176 (#29),
TAT-177 (#30), TAT-191 (#31) and TAT-178 (#32, open). TAT-178 is pushed, not merged.

**TAT-178 closed at `fef4298` with verification FAIL at round 3, the bound exhausted, by the
maintainer's decision** — he chose to keep it and test manually rather than open a fourth fix
round. All 28 checks PASS with located evidence and all 38 proofs are green; the FAIL is mutation
coverage. **No defect ships**: both surviving surfaces were read directly and are correct today
(`InviteRoleSheet.tsx:77` passes `onSelect(option.role)`; `InviteWelcomeCard.tsx:36,54` have each
label on its matching handler). What is unproven is that a regression there would be caught:

- nothing pins the callback the sheet hands **up**. `onSelect("student")` makes `Instrutor` and
  `Responsável` both share `?papel=aluno` with all 38 proofs green.
- `InviteWelcomeCard`'s two labels can be swapped: the `handlerOwnsControl` helper pairs each
  handler with its glyph, never with its label.
- two helper weaknesses behind those: `handlerOwnsControl` asserts order rather than containment,
  and `callbackBody`'s `indexOf("  );")` truncates at the first multi-line call in a body.

Owed before release, independent of the above: a manual pass of the share sheet on a real iOS
and a real Android device. No node test reaches the OS sheet.

**The standing cause, now on its fourth feature.** `apps/mobile` has no test renderer, so every
component claim is provable only by source text — and `lessons.json` records the same shape four
times (L-002, L-010, L-012, L-013, L-014, L-015). Adding `@testing-library/react-native` is a
one-way door and has been left as a recorded assumption in three plans rather than decided inside
a feature. It is the one change that would stop this recurring, and it wants its own ticket.

Also still true from TAT-191, and unchanged by TAT-178:

- `apps/mobile`'s `lint` and `typecheck` scripts are both `echo` stubs, so nothing in CI checks
  any mobile file. Run by hand, `tsc --noEmit` reports 5 pre-existing errors.
- `app/(app)/index.tsx:57-58` renders `ApiError.message` - the API's English - on a profile-load
  failure. Pre-existing, outside every feature's criteria so far.
