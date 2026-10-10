# TAT-191 pending invite verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: `origin/jeremiassnts3/tat-175-let-managers-invite-new-members-with-a-shareable-smart..HEAD` (`276c586`)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 1 returned FAIL on four gaps, all of them about the artifacts rather than the code. The fix
commit `276c586` closes all four, and each fix was **made to fail once** in isolation - including
the two counterexamples round 1 argued from in prose, which now break the suite: a success handler
that navigates nowhere, and a single-quoted `'Aluno'` literal on the role step. 46 checks, 47 named
tests, 6 faults injected and 6 killed.

**Scope of this round.** Proofs re-ran **in full at `276c586`** (green is a property of a commit).
Everything else carries forward from `6be0e7b` with a label, per verify.md's
`## Re-verifying after a fix`:

| Section | Status |
| --- | --- |
| Proofs (all 47 named tests + the repository gate) | **verified at `276c586`** |
| Citations for `gatekeeper.test.ts` C16, `invite-copy.test.ts` C34, `membership-errors.test.ts` C43 | **refreshed at `276c586`** - lines moved |
| Citations for C46 | **new at `276c586`** |
| Citations for C1-C15, C17-C33, C34's first proof, C35-C42, C44, C45 | **carried from `6be0e7b`** - the fix added lines only below them, verified by `git diff` hunk ranges |
| Coverage: the door-6 row | **recomputed at `276c586`** |
| Coverage: the other 21 rows | **carried from `6be0e7b`** - the fix touched no authority over them |
| Test policy rows 1, 4, 5 (classify a touched file or a new evidence bullet) | **re-judged at `276c586`** |
| Test policy rows 2, 3 | **carried from `6be0e7b`** |
| Step 1, binding sources | **carried from `6be0e7b`** - the fix touched no interface |
| Swept rows, C27/C28 TAT-177 regression read | **carried from `6be0e7b`** - `git diff 6be0e7b..276c586` touches neither test file's existing assertions |

## The reuse question - judged

The coordinator asked me to judge the plan's new `Flow` paragraph on
`lib/api-error-message.ts#describeApiError` the way round 1 judged door 6's row. **The reuse
rejection is sound and factually true on every load-bearing claim.** One quantity in it is wrong.

| Claim in the paragraph | Verdict against the code |
| --- | --- |
| "`describeApiError` falls back to `error.message` for any uncoded failure that is not in its `TRANSLATED` allowlist" | **True.** `lib/api-error-message.ts:55-56` checks the 6-entry `TRANSLATED` map, `:60` returns `error.detail`, `:62` returns `error.message` when it is not a `SCREAMING_CASE` code (`isCode`, `:23-25`). An uncoded failure outside the allowlist reaches `:60`/`:62` and the English string is what comes back either way. |
| "all three membership failures are uncoded - so it would answer `\"You already have an active academy membership; leave before joining another\"`" | **True, verbatim.** `apps/api/src/modules/membership/membership.service.ts:31-36` throws exactly that string as a two-argument `HttpError(409, …)` with no code; `:43-47` the 403, `:50-51` the second 409, `:26-27` the 404. None is in `TRANSLATED`, none matches `isCode`. This is precisely the defect AC 43 forbids. |
| "the two 409s are told apart by whether `/users/me` reports a membership, and `describeApiError` sees only the error" | **True by signature.** `describeApiError(error: unknown, fallback: string)`. The `fallback` cannot carry the split either: for an uncoded 409 the function returns at `:60`/`:62` and never reaches the fallback. |
| "Widening it to take a second argument would change the sentence on fifteen screens that never asked for it" | **The number is wrong.** `describeApiError` is imported by **9** files (8 screens + `components/PixPaymentView.tsx`) and called at **9** sites, not fifteen. The argument survives the correction - widening a shared formatter still reaches nine unrelated call sites - but the figure is inflated. |

**Not a reconstruction.** The decisive half of the rationale (uncoded failures leak the API's
English sentence; the function cannot see the membership that splits the two 409s) is checkable
and checks out, and it is the half that makes duplication the right call rather than widening.
That is the same bar door 6's row passed in round 1. I am recording the "fifteen screens" figure
as a **precision note in the plan's prose, not a finding**: a `Flow` reuse claim fails when the
reuse was actually available, and here it was not.

**Can the two modules disagree about the same status?** Yes, and today no user can see it.
`describeMembershipRequestError(…, false)` answers the Portuguese sentence for 403; `describeApiError`
answers the English `"Cannot request again for this academy until a manager unblocks you"` for the
same status. The two are reached from **disjoint file sets**: `grep -rl "membership-errors"` returns
`app/(app)/(joining)/academy/[academyId].tsx` and its own test, nothing else, and
`useRequestMembership` has exactly one consumer - that same screen. None of
`describeApiError`'s 9 consumers requests membership. So no screen can produce both answers for one
request.

**The latent risk, stated because it is real and nobody owns it:** a future screen that requests
membership and reaches for `describeApiError` out of habit would leak the English sentence, and
nothing stops it - C42 constrains only `membership-errors`' own output, and `apps/mobile` has no
lint. Worth an `AD-` decision row ("membership failures are described by `lib/membership-errors.ts`,
never by `describeApiError`") rather than a check. Out of scope for this feature's obligations.

One adjacent pre-existing leak, checked and out of scope: `app/(app)/index.tsx:57-58` renders
`error.message` for a non-401 `ApiError` on the profile load. `git diff` over the whole feature
range touches neither line, and AC 43 scopes "either screen" to the two S4 screens, both of which
honour it.

## Checks

Re-run in full at `276c586` in two invocations: 47 named tests across five files under one `-t`
alternation (`Tests 47 passed (47)`, every name listed individually), then
`app/+native-intent.test.ts` whole (`Tests 6 passed (6)`). 47 named tests is exactly the count
`checks.md` names across its 46 checks. No filter matched nothing.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | signed out -> `/(auth)`, `clearInvite: false`, invite or not | re-run at `276c586`, passed | carried: `lib/gatekeeper.test.ts:38` - `.toEqual({ route: "/(auth)", clearInvite: false })` inside `for (const invite of [null, INVITE_A1])` (:35) | PASS |
| C2 | user still loading -> `route: null` | re-run, passed | carried: `lib/gatekeeper.test.ts:49` - `.toEqual({ route: null, clearInvite: false })` with `user: null` (:46) | PASS |
| C3 | no `activeRole` -> `/(onboarding)/user-type`, invite kept | re-run, passed | carried: `lib/gatekeeper.test.ts:63` - `.toEqual({ route: "/(onboarding)/user-type", clearInvite: false })`, loop over `[null, INVITE_A1]` (:56) | PASS |
| C4 | manager, no academy -> `/(app)/create-academy`, spent | re-run, passed | carried: `lib/gatekeeper.test.ts:74` - `.toEqual({ route: "/(app)/create-academy", clearInvite: true })` | PASS |
| C5 | manager with academy -> `/(app)/(manager)/(home)`, spent | re-run, passed | carried: `lib/gatekeeper.test.ts:84` - `.toEqual({ route: "/(app)/(manager)/(home)", clearInvite: true })` | PASS |
| C6 | all 3 member roles, no membership, no invite -> `search-academy` | re-run, passed | carried: `lib/gatekeeper.test.ts:96` - `.toEqual({ route: "/(app)/(joining)/search-academy", clearInvite: false })` over `MEMBER_ROLES` (:88) | PASS |
| C7 | all 3 member roles + invite `"a1"` -> `/(app)/(joining)/academy/a1` | re-run, passed | carried: `lib/gatekeeper.test.ts:113` - `.toEqual({ route: "/(app)/(joining)/academy/a1", clearInvite: false })` over `MEMBER_ROLES` (:105) | PASS |
| C8 | `pending` -> `pending-approval`, spent, invite or not | re-run, passed | carried: `lib/gatekeeper.test.ts:128` - `.toEqual({ route: "/(app)/(joining)/pending-approval", clearInvite: true })`, loop `[null, INVITE_A1, INVITE_A2]` (:121) | PASS |
| C9 | active `student` -> `/(app)/(student)/(home)`, spent | re-run, passed | carried: `lib/gatekeeper.test.ts:145` - `.toEqual({ route: "/(app)/(student)/(home)", clearInvite: true })` | PASS |
| C10 | active `instructor` -> `/(app)/(instructor)/(home)`, spent | re-run, passed | carried: `lib/gatekeeper.test.ts:158` - `.toEqual({ route: "/(app)/(instructor)/(home)", clearInvite: true })` | PASS |
| C11 | active `guardian` -> `/(app)/(guardian)/(home)`, spent | re-run, passed | carried: `lib/gatekeeper.test.ts:173` - `.toEqual({ route: "/(app)/(guardian)/(home)", clearInvite: true })` | PASS |
| C12 | active in `a1` + invite `a2` -> `already-member`, spent, all 3 roles | re-run, passed | carried: `lib/gatekeeper.test.ts:185` - `.toEqual({ route: "/(app)/(joining)/already-member", clearInvite: true })` over `MEMBER_ROLES` (:177) | PASS |
| C13 | active in `a1` + invite `a1` -> that role's home, spent, all 3 roles | re-run, passed | carried: `lib/gatekeeper.test.ts:208` - `.toEqual({ route: homes[activeRole], clearInvite: true })`; `homes` literal in the same test at :194-198 | PASS |
| C14 | `blocked` -> `route: null`, invite kept | re-run, passed | carried: `lib/gatekeeper.test.ts:222` - `.toEqual({ route: null, clearInvite: false })` | PASS |
| C15 | the whole cross product answers and never throws | re-run, passed | carried: `lib/gatekeeper.test.ts:254-257` - asserts `decision.route` is `null` or a `string` and `typeof decision.clearInvite === "boolean"`; `:265` `expect(seen).toBe(2 * 5 * 2 * 4 * 3)` | PASS |
| C16 | exactly one non-test importer of `@/lib/gatekeeper` across **every** source directory | re-run, passed | **refreshed**: `lib/gatekeeper.test.ts:296` - `expect(importers).toEqual(["app/(app)/index.tsx"])`, now over `for (const dir of ["app", "components", "constants", "lib", "scripts"])` (:292-294) | PASS |
| C17 | invite readable before the write resolves | re-run, passed | carried: `lib/pending-invite.test.ts:90-93` - `.toEqual({ invite: A, hydrated: true })` with `setItem` replaced by a never-settling promise (:86) | PASS |
| C18 | mirrors to key `tatame.pending-invite` with the exact JSON | re-run, passed | carried: `lib/pending-invite.test.ts:100-103` - `toHaveBeenCalledWith(KEY, '{"academyId":"a1","role":"instructor"}')`; `KEY` at :36 | PASS |
| C19 | a fresh module hydrates the persisted invite | re-run, passed | carried: `lib/pending-invite.test.ts:115-118` - `.toEqual({ invite: { academyId: "a1", role: "instructor" }, hydrated: true })`, after `hydrated` is `false` (:111) | PASS |
| C20 | clear removes the key and nulls the snapshot | re-run, passed | carried: `lib/pending-invite.test.ts:125-127` - `toHaveBeenCalledWith(KEY)`, `.invite).toBeNull()`, `items.has(KEY)).toBe(false)` | PASS |
| C21 | all 7 unusable persisted values hydrate to `invite: null` | re-run, passed | carried: `lib/pending-invite.test.ts:151-154` - `.toEqual({ invite: null, hydrated: true })` over the 7-row table at :134-142 | PASS |
| C22 | a rejecting `getItem` resolves, stays `null`, marks hydrated | re-run, passed | carried: `lib/pending-invite.test.ts:162` `resolves.toBeUndefined()`; `:166-169` `.toEqual({ invite: null, hydrated: true })` | PASS |
| C23 | a rejecting `setItem` does not throw, invite stays readable | re-run, passed | carried: `lib/pending-invite.test.ts:176` `not.toThrow()`; `:179` `.toEqual(A)` | PASS |
| C24 | a second hydrate makes no second read | re-run, passed | carried: `lib/pending-invite.test.ts:189` - `toHaveBeenCalledTimes(1)` after two awaited hydrates | PASS |
| C25 | subscribers notified twice, an unsubscribed one never | re-run, passed | carried: `lib/pending-invite.test.ts:203-204` - `kept` 2, `dropped` 0 | PASS |
| C26 | two reads with no write between are identical | re-run, passed | carried: `lib/pending-invite.test.ts:213` `toBe(before)`; `:218` `toBe` after a write; `:221` `not.toBe(before)` | PASS |
| C27 | TAT-177's three store behaviours hold under persistence | re-run (3 named tests), passed | carried: `lib/pending-invite.test.ts:61` `toBeNull()`; `:70-71` `toEqual(B)` / `not.toEqual(A)`; `:77` `toBeNull()` | PASS |
| C28 | `redirectSystemPath` unchanged under the persisted store | `vitest run "app/+native-intent.test.ts"` at `276c586` - 6 passed | carried: `app/+native-intent.test.ts:44` `toBe("/")` invite, `:48` `toBe("/")` `/baixar`, `:74` `toBe(path)`, `:91-92` cold == warm | PASS |
| C29 | role + academy headline | re-run, passed | carried: `lib/invite-copy.test.ts:20-22` - `.toBe("Você foi convidado para ser Instrutor na Alliance Centro")` | PASS |
| C30 | role, no academy name; no `"null"`/`"undefined"` | re-run, passed | carried: `lib/invite-copy.test.ts:31-33` - `.toBe("Você foi convidado para ser Instrutor nesta academia")` + both `not.toContain`, over `[null, ""]` (:29) | PASS |
| C31 | no role, academy named | re-run, passed | carried: `lib/invite-copy.test.ts:38-40` - `.toBe("Você foi convidado para entrar na Alliance Centro")` | PASS |
| C32 | neither | re-run, passed | carried: `lib/invite-copy.test.ts:45-47` - `.toBe("Você foi convidado para entrar nesta academia")` + both `not.toContain` | PASS |
| C33 | the two role-hint sentences | re-run, passed | carried: `lib/invite-copy.test.ts:53-56` over all 3 roles and `null`; `:58-59` pins both literals | PASS |
| C34 | `ROLE_LABELS` is the one label table, and the screen carries no label text **in any form** | re-run (2 named tests), passed | first proof carried: `lib/invite-copy.test.ts:65-69` `.toEqual({ student: "Aluno", instructor: "Instrutor", guardian: "Responsável" })`. **refreshed**: `:77` `toContain("ROLE_LABELS")` and `:83` `expect(screen, label).not.toContain(label)` - the bare text, no longer `"${label}"` | PASS |
| C35 | 403 sentence | re-run, passed | carried: `lib/membership-errors.test.ts:23-27` - `.toBe("Você não pode solicitar entrada nesta academia novamente até que um gestor libere seu acesso.")` | PASS |
| C36 | 409 with a membership | re-run, passed | carried: `lib/membership-errors.test.ts:31-33` - `(…, true)` `.toBe("Você já faz parte de uma academia. Saia da atual antes de entrar em outra.")` | PASS |
| C37 | 409 without a membership | re-run, passed | carried: `lib/membership-errors.test.ts:40-42` - `(…, false)` `.toBe("Você já tem uma solicitação pendente nesta academia.")` | PASS |
| C38 | 404 and 400 share one sentence | re-run, passed | carried: `lib/membership-errors.test.ts:48-51` - loop `[400, 404]`, `.toBe("Academia não encontrada. Peça um link de convite novo ao gestor.")` | PASS |
| C39 | unrecognised failures fall back | re-run, passed | carried: `lib/membership-errors.test.ts:64-67` over `[ApiError(500), Error, string, null]` (:56-61) | PASS |
| C40 | academy load, 404 and 400 | re-run, passed | carried: `lib/membership-errors.test.ts:76-78` - loop `[400, 404]`, `.toBe("Academia não encontrada. O link de convite pode estar inválido.")` | PASS |
| C41 | academy load, anything else | re-run, passed | carried: `lib/membership-errors.test.ts:86-88` over `[ApiError(500), Error]` | PASS |
| C42 | all 7 sentences accented, none leaks the API text | re-run, passed | carried: `lib/membership-errors.test.ts:111` `toHaveLength(7)`; `:116` `toMatch(/[áâãàéêíóôõúüç]/i)`; `:123` `not.toContain` over every 3-word window | PASS |
| C43 | `onSuccess` carries exactly one `router.replace`, it is `/(app)`, no branch on the status, and the screen holds no `(joining)/pending-approval` | re-run, passed | **refreshed**: `lib/membership-errors.test.ts:133` `not.toContain("(joining)/pending-approval")`; slice `:138-140`; `:143` `toContain('router.replace("/(app)")')`; `:144` `expect(onSuccess.match(/router\.replace\(/g)).toHaveLength(1)`; `:145-146` `not.toContain("data.status")` / `not.toContain('"active"')` | PASS |
| C44 | the guardian home is byte-identical to the feature base | `git diff --quiet <base> -- "…/(guardian)/(home)/index.tsx"` at `276c586` | exit `0`, run by me; also `--quiet` against `6be0e7b` exit `0`, so the fix did not touch it | PASS |
| C45 | suite, lint and typecheck stay green | `pnpm turbo run test/lint/typecheck --force` at `276c586` | **974 passed, 0 failed** (873 API · 30 web · **71 mobile, from 69**); lint 8/8, 0 errors; typecheck 13/13 | PASS |
| C46 | `lib/api.ts`'s `ApiError` is identical by reference to `lib/api-error.ts`'s class, `instanceof` holds both ways, and >= 10 non-test files still import it from `@/lib/api` (door 6) | re-run (2 named tests), passed | **new**: `lib/api-error.test.ts:22` `expect(api.ApiError).toBe(ApiError)`; `:23-24` `instanceof` in both directions; `:58` `expect(importers.length).toBeGreaterThanOrEqual(10)`; `:61` `expect(api).toContain('export { ApiError } from "@/lib/api-error";')` | PASS |

**Citation carry-forward is checked, not assumed.** `git diff 6be0e7b..276c586` touches four
`apps/mobile` files; its hunks start at `gatekeeper.test.ts:286`, `invite-copy.test.ts:75`,
`membership-errors.test.ts:129`, and `api-error.test.ts` is new. Every carried citation above sits
above its file's hunk, so no carried line number moved.

**`apps/mobile` typecheck, re-run by hand at `276c586`**: `pnpm exec tsc --noEmit` reports exactly
**5 errors**, the same five locations as round 1 -
`app/(app)/(manager)/(members)/[membershipId].tsx(226,36)` and `(229,23)`,
`app/(app)/(student)/register-belt.tsx(22,7)`, `app/_layout.tsx(1,8)`,
`components/DependentSelectionModal.tsx(73,31)`. All pre-existing, none in a file this feature or
the fix touches. The coordinator's claim holds.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| **one-way doors (6)** - *recomputed at `276c586`* | `plan.md` `## Landing`, six rows | door 1 C18/C19/C21 · door 2 C16 · door 3 M1 · door 4 M4 · door 5 the `clearInvite` row · **door 6 C46** | - |
| **door 6's two halves (2)** - *recomputed at `276c586`* | door 6's literal shape: the class moved verbatim, **and** the re-export that keeps the importers compiling | one class through both paths `lib/api-error.test.ts:22-24` · the re-export line plus the importer census `:58`, `:61` | - |
| modules that turn an `ApiError` into a user sentence (2) - *swept at `276c586`* | `grep` for `instanceof ApiError` consumers in `apps/mobile/lib` | `lib/membership-errors.ts` C35-C42 · `lib/api-error-message.ts#describeApiError` pre-existing (TAT-186), untouched by this range, outside this feature's obligations by the `Test policy` evidence bullet | - |
| gatekeeper route outcomes (14) - *carried from `6be0e7b`* | `lib/gatekeeper.ts:74-126` branch walk, 8 `return` sites, `MEMBER_HOME` expanding one into 3 | C1-C14, one asserted case each | - |
| `clearInvite` per outcome (14) - *carried* | the same walk; every `return` carries the flag | C1-C14 each assert the whole object with `toEqual` | - |
| member roles reaching the join path (3) - *carried* | `MEMBER_HOME` keys | C6 and C7 both iterate `MEMBER_ROLES` | - |
| active-membership home routes (3) - *carried* | `MEMBER_HOME` keys | C9 · C10 · C11; C13 re-iterates all three | - |
| invite academy vs membership academy (2) - *carried* | `gatekeeper.ts:118` | different C12 · same C13 | - |
| unusable persisted values (7) - *carried* | `parsePersistedInvite` rejection branches | C21, table-driven over all 7 | - |
| store transitions (6) - *carried* | Test policy row 3's list | empty C27 · written C17 · overwritten C27 · cleared C20 · recovered C19 · storage failing C22/C23 | - |
| storage call surfaces (3) - *carried* | `getItem`, `setItem`, `removeItem` | read-rejects C22 · write-rejects C23 · `removeItem` shares the one `try/catch` in `mirror()` that C23 pins | - |
| subscriber notification (3) - *carried* | the `listeners` set | on set, on clear, after unsubscribe - all three in C25's two counts | - |
| hydration call count (2) - *carried* | the `snapshot.hydrated` guard | first reads C19 · second does not C24 | - |
| headline variants (4) - *carried* | 2 `what` x 2 `where` | C29 · C30 · C31 · C32 | - |
| role hint sentences (2) - *carried* | the `inviteRoleHint` ternary | C33 asserts both arms and both literals | - |
| role labels (3) - *carried* | `ROLE_LABELS` keys | C34, `toEqual` over the whole table | - |
| membership-request failure classes (6) - *carried* | the `switch` plus the `instanceof` guard | 403 C35 · 409+membership C36 · 409 without C37 · 404 C38 · 400 C38 · unrecognised C39 | - |
| academy-load failure classes (3) - *carried* | `describeAcademyLoadError` | 404 C40 · 400 C40 · unrecognised C41 | - |
| Portuguese sentences (7) - *carried* | the distinct literals the two dispatches return | C42, table-driven, length pinned at 7 | - |
| test assemblies needing the AsyncStorage double (2) - *carried* | `vi.mock` occurrences across the mobile test files | `lib/pending-invite.test.ts:32-34` · `app/+native-intent.test.ts:12-19` | - |
| test assemblies needing a `@clerk/clerk-expo` double (1) - *swept at `276c586`* | the new file is the only test that loads `lib/api.ts` | `lib/api-error.test.ts:11-13` - read directly; without it the import throws rather than failing an assertion | - |
| `+native-intent` outcomes (3) - *carried* | the three return paths | invite C28 · `/baixar` C28 · pass-through C28 | - |
| approved criteria -> proof (46) - *carried* | `plan.md` AC 1-46 | AC 1-15 C1-C15 · 16 M1 · 17 C16 · 18-26 C17-C26 · 27-32 C29-C34 · 33-35 M2-M4 · 36-40 C35-C39 · 41 C40+M5 · 42 C41+M6 · 43 C42+M7 · 44 C43+M4 · 45 C44+M8 · 46 C45. C46 carries door 6, which no AC names | - |
| manually exempted criteria (8) - *carried* | `checks.md`'s header enumeration | 16 M1 · 33 M2 · 34 M3 · 35 M4 · 41 M5 · 42 M6 · 43 M7 · 45 M8, all enumerated, plus two voluntary rows. The fix added no exemption | - |

The round-1 sweep found one set with a member the table had hidden. **That member now has a proof,
and the proof has been made to fail.** No new set entered with `276c586`: the fix adds one test
file and strengthens three assertions, and the only new enumerations it introduces - door 6's two
halves and the `@clerk/clerk-expo` double - have rows above.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, pure module, no platform import - *re-judged at `276c586`* | `lib/gatekeeper.ts`, `lib/invite-copy.ts`, `lib/membership-errors.ts` | one at its own layer, one asserted case per decision row, every rejected input its own member | yes - 14/14 route rows C1-C14, 4+2+3 copy variants C29-C34, 6+3 error classes C35-C41. The fix strengthened two of these files' tests and weakened none: `git diff` shows additions only |
| Decides, behind a platform module the node harness cannot load - *carried from `6be0e7b`* | zero files in this diff; the artifact's evidence assigns `lib/pending-invite.ts` to row 3 | - | yes - vacuous here, since the row classifies zero files and therefore requires nothing |
| Module-scoped mutable state with a persisted mirror - *carried from `6be0e7b`* | `lib/pending-invite.ts` | one per transition and one per read path | yes - all six listed states have a proof, and both read paths are asserted (`getPendingInviteSnapshot` at :90/:126/:213, `readPendingInvite` at :61/:70/:179) |
| A screen in a package with no renderer - *re-judged at `276c586`* | `app/(app)/index.tsx`, `app/(onboarding)/user-type.tsx`, `app/(app)/(joining)/academy/[academyId].tsx`, `app/(app)/(joining)/already-member.tsx` | no proof at its own layer; every decision moved into a pure module; the wiring carries a named manual pass with its expected observation | yes - and two of these screens are now held to their bytes as well: C43 pins `academy/[academyId].tsx`'s single success destination, C34 pins that `user-type.tsx` carries zero label text. M1-M9 each state an expected observation. The residue stands: `already-member.tsx:46-48` keeps a two-variant sentence inline, which the row permits because M9 names its observation |
| Instrumentation - a re-export, a hook into a store, a `useQuery` wrapper - *re-judged at `276c586`* | `lib/hooks/use-pending-invite.ts`, `lib/api.ts#getPublicAcademy`, `lib/hooks/use-academy.ts#usePublicAcademy`, `lib/api.ts`'s `export { ApiError }`, and the new evidence bullet's `lib/api-error.ts` | none of its own; covered by its consumer's proof | yes - the first three are covered as before (the store by C17-C27, the public lookup end to end by M2). The `ApiError` re-export is the one round 1 found uncovered, and C46 now covers it directly rather than through a consumer; `checks.md`'s new bullet says why an instrumentation-shaped file earns its own check here, and the reasoning is sound: the package has neither lint nor typecheck, so a consumer's proof does not exist to inherit |

Both new evidence bullets check out. `lib/api-error.ts` is indeed a class with no conditional
(instrumentation by shape), and the bullet's argument for giving it a check anyway is exactly the
round-1 finding. `lib/api-error-message.ts`'s bullet - pre-existing, untouched, deliberately not
reused - is accurate and its reasoning is judged above.

## Faults injected

Baseline `git status --porcelain` of the real tree: **empty**. Isolation:
`git worktree add <scratchpad>/mutant2 HEAD` with the workspace `node_modules` symlinked in; no
`git stash` at any point. After `git worktree remove --force`, the real tree's porcelain is
**empty again - matches the baseline**.

Scoped to the surfaces `276c586` touched or created, per verify.md. Five surfaces, six mutations:
C43's assertion set was **rewritten** in this commit and its two halves - "a destination exists" and
"exactly one destination, chosen without looking at the status" - are independent, so each was
mutated once rather than inferring the second from the first. Every other surface got one.

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| deleted `export { ApiError } from "@/lib/api-error";` - *the exact regression round 1 said nothing would catch* | `lib/api.ts:4` | C46 `-t "keeps every existing importer compiling"` | yes - 1 failed, 1 skipped |
| split the class: internal import aliased to `BaseApiError`, `export class ApiError extends BaseApiError {}` in its place | `lib/api.ts:2,4` | C46 `-t "is the same class through lib/api as through lib/api-error"` | yes - 1 failed, 1 skipped. Confirms the reference-identity assertion, which a byte check could not have made |
| branched the success destination on the response status: `if (data.status === "active") router.replace("/(app)/(student)/(home)")` added above the existing replace | `app/(app)/(joining)/academy/[academyId].tsx:40` | C43 `-t "leaves the destination to the gatekeeper"` | yes - 1 failed, 8 skipped |
| removed the success navigation entirely, leaving `onSuccess` a no-op - *round 1's counterexample: "a screen that navigated nowhere on success would have passed it"* | `app/(app)/(joining)/academy/[academyId].tsx:45` | C43 `-t "leaves the destination to the gatekeeper"` | yes - 1 failed, 8 skipped |
| `label: ROLE_LABELS.student` -> `label: 'Aluno'` - *round 1's counterexample: a single-quoted literal the `"${label}"` search walked past* | `app/(onboarding)/user-type.tsx:25` | C34 `-t "is the only place the role step gets its labels"` | yes - 1 failed, 6 skipped. The first assertion still passed, isolating the strengthened one |
| added `import { resolveGatekeeperRoute } from "@/lib/gatekeeper";` to a `components/` file - *a second consumer in a directory the round-1 walk never entered* | `components/Avatar.tsx:1` | C16 `-t "has exactly one importer"` | yes - 1 failed, 15 skipped |

**All four round-1 gaps are closed by experiment, not by inspection.** Three of the six mutations
are the literal counterexamples round 1 argued from in prose, and all three now break the suite.

## Precision notes (recorded, not verdict-bearing)

- **C46's importer census has slack and one false positive.** The regex at `lib/api-error.test.ts:49`
  matches 12 files, but one of them is `lib/api-error.ts` itself, whose doc comment at `:10` contains
  the literal text `` `import { ApiError } from "@/lib/api"` ``. So there are **11** real import
  statements against a floor of `>= 10`: two could migrate away before the assertion fires. The
  claim as written ("at least 10 non-test files still import `ApiError` from `@/lib/api`") is
  satisfied either way, and the decisive half of C46 - reference identity plus the re-export line -
  is exact and proven killable twice. Tightening it would mean excluding comment lines and pinning
  the count rather than a floor.
- **The plan's "fifteen screens" is 9 files / 9 call sites.** Judged above; the reuse rejection
  survives the correction.
- **C15 still understates its own proof** - the claim says "none of the 48", the test enumerates 240.
  *Carried from `6be0e7b`.*
- **`already-member.tsx:46-48`** keeps a two-variant sentence inline rather than in
  `lib/invite-copy.ts` - the one decision in this feature that did not move into a pure module.
  Within Test policy row 4 because M9 names the observation. *Carried from `6be0e7b`.*

## Gate

Re-run in full at `276c586`:

- `pnpm turbo run test --force` - **974 passed, 0 failed**, 8/8 tasks: 873 API across 58 files,
  30 web across 10, **71 mobile across 8 files** (from 69 / 7 at `6be0e7b`, and 27 at the feature
  base). The two new tests are C46's.
- `pnpm turbo run lint --force` - 8/8 tasks, **0 errors**, 5 warnings, all pre-existing in
  `apps/web/components/ui/beams-background.tsx`. `apps/mobile` is still not linted
  (`"lint": "echo 'no lint configured'"`), which is why C46 had to exist.
- `pnpm turbo run typecheck --force` - 13/13 tasks clean; `apps/mobile`'s task is an `echo`, and by
  hand `tsc --noEmit` gives the same 5 pre-existing errors as round 1.
- `git diff --quiet <base> -- "apps/mobile/app/(app)/(guardian)/(home)/index.tsx"` - exit `0`.
