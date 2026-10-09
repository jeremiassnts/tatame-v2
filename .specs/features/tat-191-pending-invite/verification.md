# TAT-191 pending invite verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: `origin/jeremiassnts3/tat-175-let-managers-invite-new-members-with-a-shareable-smart..HEAD` (`6be0e7b`)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

One gap, and it is a coverage gap rather than a broken check: **all 45 checks pass with located
evidence, all 5 injected mutants were killed, and the repository gate is green** - but the plan's
`Landing` carries **six** one-way doors and `checks.md` gave five of them a row. Door 6's
`lib/api.ts` re-export of `ApiError` has no proof anywhere in the tree, and `apps/mobile`'s
`lint` **and** `typecheck` scripts are both `echo` stubs, so the repository gate cannot catch its
removal either.

## Step 1 - binding sources (`standard`: recorded, not enumerated)

The plan marks three sources and all three were opened: **TAT-191** (read in full from Linear -
the four-row destination table, the AsyncStorage and "the role step cannot be skipped"
constraints), **TAT-177 / PR #30** (read as the diff of `lib/pending-invite.ts` and
`app/+native-intent.test.ts` across the range), and **`apps/mobile/vitest.config.ts`**
(`environment: "node"`, `include: ["{app,lib}/**/*.test.ts", "*.test.ts"]`, `@` -> package root).
No check contradicts any of them. Two places where the build deliberately departs from the
ticket's prose were checked and judged sound, not findings:

- **Door 4.** TAT-191 says "`handleContinue` ... must land on `(joining)/academy/<academyId>`"
  *and* "Routing decisions stay in `(app)/index.tsx`". The build kept
  `router.replace("/(app)")` (`app/(onboarding)/user-type.tsx:67`) and lets the gatekeeper decide
  one hop later. The destination is genuinely identical: after `syncUser(token, selected)` and the
  `["user","me"]` refetch the person has `activeRole` set, `activeMembership: null` and the invite
  still held (`clearInvite: false` on the no-role row, C3), which is exactly
  `gatekeeper.ts:99-108`'s `/(app)/(joining)/academy/${invite.academyId}`.
- **AC 13 vs the ticket's table.** The ticket collapses "membership `active`" into one row ("a
  friendly 'you already belong to an academy' screen"); the plan splits it by whether the invite
  names the same academy. The ticket's own `Cases to cover` draws the same distinction ("already
  belongs to **that** academy -> a sensible screen, not a duplicate request"), so this is a
  refinement, not a contradiction.

## Checks

All run by me at `HEAD` in two invocations (45 named tests in one filtered run across four files,
then `app/+native-intent.test.ts` whole). Every named test appears individually in the output.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | signed out -> `/(auth)`, `clearInvite: false`, invite or not | vitest `-t` alternation, 45/45 passed | `lib/gatekeeper.test.ts:38` - `.toEqual({ route: "/(auth)", clearInvite: false })` inside `for (const invite of [null, INVITE_A1])` (:35) | PASS |
| C2 | user still loading -> `route: null` | same run | `lib/gatekeeper.test.ts:49` - `.toEqual({ route: null, clearInvite: false })` with `user: null` (:46) | PASS |
| C3 | no `activeRole` -> `/(onboarding)/user-type`, invite kept | same run | `lib/gatekeeper.test.ts:63` - `.toEqual({ route: "/(onboarding)/user-type", clearInvite: false })`, loop over `[null, INVITE_A1]` (:56) | PASS |
| C4 | manager, no academy -> `/(app)/create-academy`, `clearInvite: true` | same run | `lib/gatekeeper.test.ts:74` - `.toEqual({ route: "/(app)/create-academy", clearInvite: true })` | PASS |
| C5 | manager with academy -> `/(app)/(manager)/(home)`, spent | same run | `lib/gatekeeper.test.ts:84` - `.toEqual({ route: "/(app)/(manager)/(home)", clearInvite: true })` | PASS |
| C6 | all 3 member roles, no membership, no invite -> `search-academy` | same run | `lib/gatekeeper.test.ts:96` - `.toEqual({ route: "/(app)/(joining)/search-academy", clearInvite: false })` over `MEMBER_ROLES` (:88) | PASS |
| C7 | all 3 member roles + invite `"a1"` -> `/(app)/(joining)/academy/a1` | same run | `lib/gatekeeper.test.ts:113` - `.toEqual({ route: "/(app)/(joining)/academy/a1", clearInvite: false })` over `MEMBER_ROLES` (:105) | PASS |
| C8 | `pending` -> `pending-approval`, spent, invite or not | same run | `lib/gatekeeper.test.ts:128` - `.toEqual({ route: "/(app)/(joining)/pending-approval", clearInvite: true })`, loop `[null, INVITE_A1, INVITE_A2]` (:121) | PASS |
| C9 | active `student` -> `/(app)/(student)/(home)`, spent | same run | `lib/gatekeeper.test.ts:145` - `.toEqual({ route: "/(app)/(student)/(home)", clearInvite: true })` | PASS |
| C10 | active `instructor` -> `/(app)/(instructor)/(home)`, spent | same run | `lib/gatekeeper.test.ts:158` - `.toEqual({ route: "/(app)/(instructor)/(home)", clearInvite: true })` | PASS |
| C11 | active `guardian` -> `/(app)/(guardian)/(home)`, spent | same run | `lib/gatekeeper.test.ts:173` - `.toEqual({ route: "/(app)/(guardian)/(home)", clearInvite: true })` | PASS |
| C12 | active in `a1` + invite `a2` -> `already-member`, spent, all 3 roles | same run | `lib/gatekeeper.test.ts:185` - `.toEqual({ route: "/(app)/(joining)/already-member", clearInvite: true })` over `MEMBER_ROLES` (:177) | PASS |
| C13 | active in `a1` + invite `a1` -> that role's home, spent, all 3 roles | same run | `lib/gatekeeper.test.ts:208` - `.toEqual({ route: homes[activeRole], clearInvite: true })`; `homes` literal is in the same test at :194-198, readable at the assertion | PASS |
| C14 | `blocked` -> `route: null`, invite kept | same run | `lib/gatekeeper.test.ts:222` - `.toEqual({ route: null, clearInvite: false })` | PASS |
| C15 | the whole cross product answers and never throws | same run | `lib/gatekeeper.test.ts:254-257` - `expect(decision.route === null \|\| typeof decision.route === "string").toBe(true)` + `expect(typeof decision.clearInvite).toBe("boolean")`; `:265` `expect(seen).toBe(2 * 5 * 2 * 4 * 3)` | PASS |
| C16 | exactly one non-test importer of `@/lib/gatekeeper`, and it is `app/(app)/index.tsx` | same run | `lib/gatekeeper.test.ts:292` - `expect(importers).toEqual(["app/(app)/index.tsx"])` over a recursive `app/` + `lib/` walk (:289-290) | PASS |
| C17 | invite readable before the write resolves | same run | `lib/pending-invite.test.ts:90-93` - `.toEqual({ invite: A, hydrated: true })` after `setItem` is replaced by a never-settling promise (:86) | PASS |
| C18 | mirrors to key `tatame.pending-invite` with the exact JSON | same run | `lib/pending-invite.test.ts:100-103` - `expect(storage.setItem).toHaveBeenCalledWith(KEY, '{"academyId":"a1","role":"instructor"}')`; `KEY` is `"tatame.pending-invite"` at :36 | PASS |
| C19 | a fresh module hydrates the persisted invite | same run | `lib/pending-invite.test.ts:115-118` - `.toEqual({ invite: { academyId: "a1", role: "instructor" }, hydrated: true })`, preceded by `expect(...hydrated).toBe(false)` (:111) | PASS |
| C20 | clear removes the key and nulls the snapshot | same run | `lib/pending-invite.test.ts:125-127` - `expect(storage.removeItem).toHaveBeenCalledWith(KEY)`, `expect(getPendingInviteSnapshot().invite).toBeNull()`, `expect(storage.items.has(KEY)).toBe(false)` | PASS |
| C21 | all 7 unusable persisted values hydrate to `invite: null` | same run | `lib/pending-invite.test.ts:151-154` - `.toEqual({ invite: null, hydrated: true })` over the 7-row table at :134-142 | PASS |
| C22 | a rejecting `getItem` resolves, stays `null`, marks hydrated | same run | `lib/pending-invite.test.ts:162` - `await expect(fresh.hydratePendingInvite()).resolves.toBeUndefined()`; `:166-169` `.toEqual({ invite: null, hydrated: true })` | PASS |
| C23 | a rejecting `setItem` does not throw, invite stays readable | same run | `lib/pending-invite.test.ts:176` - `expect(() => fresh.setPendingInvite(A)).not.toThrow()`; `:179` `expect(fresh.readPendingInvite()).toEqual(A)` | PASS |
| C24 | a second hydrate makes no second read | same run | `lib/pending-invite.test.ts:189` - `expect(storage.getItem).toHaveBeenCalledTimes(1)` after two awaited hydrates | PASS |
| C25 | subscribers notified twice, an unsubscribed one never | same run | `lib/pending-invite.test.ts:203-204` - `expect(kept).toHaveBeenCalledTimes(2)` / `expect(dropped).toHaveBeenCalledTimes(0)` | PASS |
| C26 | two reads with no write between are identical | same run | `lib/pending-invite.test.ts:213` - `expect(fresh.getPendingInviteSnapshot()).toBe(before)`; `:218` `toBe` after a write; `:221` `expect(afterWrite).not.toBe(before)` | PASS |
| C27 | TAT-177's three store behaviours hold under persistence | same run (3 named tests) | `lib/pending-invite.test.ts:61` `expect(fresh.readPendingInvite()).toBeNull()`; `:70-71` `toEqual(B)` / `not.toEqual(A)`; `:77` `toBeNull()` after clear | PASS |
| C28 | `redirectSystemPath` unchanged under the persisted store | `vitest run "app/+native-intent.test.ts"` - 6 passed | `app/+native-intent.test.ts:44` `toBe("/")` for the invite, `:48` `toBe("/")` for `/baixar`, `:74` `toBe(path)` byte for byte, `:91-92` cold == warm | PASS |
| C29 | role + academy headline | same filtered run | `lib/invite-copy.test.ts:20-22` - `.toBe("Você foi convidado para ser Instrutor na Alliance Centro")` | PASS |
| C30 | role, no academy name; no `"null"`/`"undefined"` | same run | `lib/invite-copy.test.ts:31-33` - `.toBe("Você foi convidado para ser Instrutor nesta academia")` + `not.toContain("null")` / `not.toContain("undefined")`, over `[null, ""]` (:29) | PASS |
| C31 | no role, academy named | same run | `lib/invite-copy.test.ts:38-40` - `.toBe("Você foi convidado para entrar na Alliance Centro")` | PASS |
| C32 | neither | same run | `lib/invite-copy.test.ts:45-47` - `.toBe("Você foi convidado para entrar nesta academia")` + both `not.toContain` | PASS |
| C33 | the two role-hint sentences | same run | `lib/invite-copy.test.ts:53-56` - `inviteRoleHint` over all 3 roles and `null`; `:58-59` pins the literals `"Você pode escolher outro perfil se preferir."` / `"Selecione o seu perfil para continuar."` | PASS |
| C34 | `ROLE_LABELS` is the single label table the role step reads | same run (2 named tests) | `lib/invite-copy.test.ts:65-69` - `.toEqual({ student: "Aluno", instructor: "Instrutor", guardian: "Responsável" })`; `:77-80` `expect(screen).toContain("ROLE_LABELS")` + `not.toContain(\`"${label}"\`)` for all three | PASS |
| C35 | 403 sentence | same run | `lib/membership-errors.test.ts:23-27` - `describeMembershipRequestError(new ApiError(403, API_403), false)` `.toBe("Você não pode solicitar entrada nesta academia novamente até que um gestor libere seu acesso.")` | PASS |
| C36 | 409 with a membership | same run | `lib/membership-errors.test.ts:31-33` - `new ApiError(409, …), true` `.toBe("Você já faz parte de uma academia. Saia da atual antes de entrar em outra.")` | PASS |
| C37 | 409 without a membership | same run | `lib/membership-errors.test.ts:40-42` - `new ApiError(409, …), false` `.toBe("Você já tem uma solicitação pendente nesta academia.")` | PASS |
| C38 | 404 and 400 share one sentence | same run | `lib/membership-errors.test.ts:48-51` - loop `[400, 404]`, `.toBe("Academia não encontrada. Peça um link de convite novo ao gestor.")` | PASS |
| C39 | unrecognised failures fall back | same run | `lib/membership-errors.test.ts:64-67` - `.toBe("Não foi possível enviar sua solicitação. Tente novamente.")` over `[ApiError(500), Error, string, null]` (:56-61) | PASS |
| C40 | academy load, 404 and 400 | same run | `lib/membership-errors.test.ts:76-78` - loop `[400, 404]`, `.toBe("Academia não encontrada. O link de convite pode estar inválido.")` | PASS |
| C41 | academy load, anything else | same run | `lib/membership-errors.test.ts:86-88` - `.toBe("Não foi possível carregar a academia. Verifique sua conexão e tente novamente.")` over `[ApiError(500), Error]` | PASS |
| C42 | all 7 sentences accented, none leaks the API text | same run | `lib/membership-errors.test.ts:111` `expect(cases).toHaveLength(7)`; `:116` `toMatch(/[áâãàéêíóôõúüç]/i)`; `:123` `not.toContain(words.slice(i, i + 3).join(" "))` over every 3-word window of the API message | PASS |
| C43 | the academy screen holds no `(joining)/pending-approval` destination | same run | `lib/membership-errors.test.ts:132` - `expect(screen).not.toContain("(joining)/pending-approval")` against the real file bytes (:16-19, :131) | PASS |
| C44 | the guardian home is byte-identical to the feature base | `git diff --quiet <base> -- "apps/mobile/app/(app)/(guardian)/(home)/index.tsx"` | exit `0`, run by me | PASS |
| C45 | suite, lint and typecheck stay green | `pnpm turbo run test/lint/typecheck --force` | 972 passed / 0 failed (873 API, 30 web, **69 mobile from 27**); lint 8/8 tasks, 0 errors + the 5 pre-existing `apps/web` warnings; typecheck 13/13 | PASS |

**Proof hygiene.** No proof resolves only to an untouched test: every file cited above is either new
in the range or modified by it (`git diff --stat` shows all seven). No filter matched nothing - the
single `-t` alternation reported `Tests 45 passed (45)` with each name listed individually, and
45 is exactly the number of named tests in `checks.md`.

**`apps/mobile` typecheck, run by hand** (`pnpm exec tsc --noEmit`): exactly **5 errors**, all
pre-existing and none in a file this feature touches -
`app/(app)/(manager)/(members)/[membershipId].tsx` (2), `app/(app)/(student)/register-belt.tsx`,
`app/_layout.tsx` (`global.css` side-effect import), `components/DependentSelectionModal.tsx`. All
are `Belt`-indexing or CSS-typing errors unrelated to this feature's symbols. The author's claim
holds.

## Coverage

Recomputed from the authority over each set, not read back from `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| gatekeeper route outcomes (14) | `lib/gatekeeper.ts:74-126` branch walk - 8 `return` sites, with `MEMBER_HOME` (`:54-64`) expanding one into 3 | C1-C14, one asserted case each | - |
| `clearInvite` per outcome (14) | same walk; every `return` carries the flag | C1-C14 all assert the whole object with `toEqual`, so the flag is pinned in each | - |
| member roles reaching the join path (3) | `MEMBER_HOME` keys = `instructor`, `student`, `guardian` | C6 and C7 both iterate `MEMBER_ROLES` (`gatekeeper.test.ts:13`) | - |
| active-membership home routes (3) | `MEMBER_HOME` keys | C9, C10, C11 individually; C13 re-iterates all three | - |
| invite academy vs membership academy (2) | `gatekeeper.ts:118` comparison | different C12 · same C13 | - |
| unusable persisted values (7) | `parsePersistedInvite` rejection branches (`pending-invite.ts:80-100`) | C21, table-driven over all 7 | - |
| store transitions (6) | Test policy row 3's own list | empty C27 · written C17 · overwritten C27 · cleared C20 · recovered C19 · storage failing C22/C23 | - |
| storage call surfaces (3) | `getItem`, `setItem`, `removeItem` - the only AsyncStorage calls in the module | read-rejects C22 · write-rejects C23 · `removeItem` shares the single `try/catch` in `mirror()` (`pending-invite.ts:57-69`) that C23 pins | - |
| subscriber notification (3) | `listeners` set add/delete/emit (`pending-invite.ts:45-55`) | on set, on clear and after unsubscribe, all three in C25's two call counts | - |
| hydration call count (2) | the `snapshot.hydrated` guard (`pending-invite.ts:148`, re-checked `:159`) | first call reads C19 · second does not C24 | - |
| headline variants (4) | `inviteHeadline` = 2 `what` x 2 `where` (`invite-copy.ts:35-37`) | C29 · C30 · C31 · C32 | - |
| role hint sentences (2) | `inviteRoleHint` ternary (`invite-copy.ts:46-48`) | C33 asserts both arms and both literals | - |
| role labels (3) | `ROLE_LABELS` keys (`invite-copy.ts:16-20`) | C34, `toEqual` over the whole table | - |
| membership-request failure classes (6) | `describeMembershipRequestError` switch + the `instanceof` guard | 403 C35 · 409+membership C36 · 409 without C37 · 404 C38 · 400 C38 · unrecognised C39 (4 shapes) | - |
| academy-load failure classes (3) | `describeAcademyLoadError` (`membership-errors.ts:53-64`) | 404 C40 · 400 C40 · unrecognised C41 | - |
| Portuguese sentences (7) | distinct string literals returned by the two dispatches | C42, table-driven, length pinned at 7 | - |
| test assemblies needing the AsyncStorage double (2) | `vi.mock(...)` occurrences across the 7 mobile test files | `lib/pending-invite.test.ts:32-34` · `app/+native-intent.test.ts:12-19` - both read directly, not inferred from a green run | - |
| `+native-intent` outcomes (3) | `redirectSystemPath`'s three return paths | invite C28 · `/baixar` C28 · pass-through C28 | - |
| approved criteria -> proof (46) | `plan.md` `## Criteria`, AC 1-46 | AC 1-15 C1-C15 · 16 M1 · 17 C16 · 18-26 C17-C26 · 27-32 C29-C34 · 33-35 M2-M4 · 36-40 C35-C39 · 41 C40+M5 · 42 C41+M6 · 43 C42+M7 · 44 C43+M4 · 45 C44+M8 · 46 C45 | - |
| manually exempted criteria (8) | `checks.md` header's enumeration | 16 M1 · 33 M2 · 34 M3 · 35 M4 · 41 M5 · 42 M6 · 43 M7 · 45 M8. The roteiro enumerates all eight and adds two voluntary rows (M9 for AC 12, M10 for door 1), both of which also hold automated checks. **Not** a blanket exemption | - |
| **one-way doors (6)** | **`plan.md` `## Landing`, which carries six rows** | door 1 C18/C19/C21 · door 2 C16 · door 3 M1 · door 4 M4 · door 5 the `clearInvite` row | **door 6 - the `lib/api.ts` re-export of `ApiError`** |

**The door-6 row is the failure.** `checks.md`'s header says "5 one-way doors" and its Coverage
prose asserts "Every one-way door has a check", listing doors 1-5; the plan carries six. Door 6's
literal shape has two halves. The first - `ApiError` living in `lib/api-error.ts` - is exercised
by C35-C42, which import it from `@/lib/api-error` and construct it. The second -
`export { ApiError } from "@/lib/api-error";` in `lib/api.ts:4`, which is what keeps the ten
existing `import { ApiError } from "@/lib/api"` sites compiling - has **no proof anywhere**:

- `grep -rn 'from "@/lib/api"' --include="*.test.ts"` over all 7 mobile test files returns nothing,
  so no test loads the re-export.
- `apps/mobile/package.json` sets `"typecheck": "echo 'skipped: …'"` **and**
  `"lint": "echo 'no lint configured'"` (line 10). So `pnpm turbo run typecheck` and
  `pnpm turbo run lint` - two thirds of C45 - execute nothing at all against `apps/mobile`.

Deleting that one line therefore breaks `app/(app)/index.tsx`, `(manager)/_layout.tsx`,
`lib/hooks/use-payout-account.ts`, `lib/api-error-message.ts` and six more screens while the whole
gate stays green. I verified the re-export is present and correct today (`lib/api.ts:2,4`, class
moved verbatim, same JSDoc), so this is a missing obligation, not a defect.

On door 6's **honesty**, which the brief asked me to attack: the plan's bullet is honest, not a
reconstruction. It states plainly that the door was recorded after the commit that introduced it,
names the concrete trigger (`membership-errors.test.ts` would not load) and the concrete
alternative (duck-typing on `"status" in error`), and its stated reason is independently true -
`lib/api.ts:1` does `import { useAuth } from "@clerk/clerk-expo"`, which pulls in `react-native`
and cannot load under `environment: "node"`.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, pure module, no platform import | `lib/gatekeeper.ts`, `lib/invite-copy.ts`, `lib/membership-errors.ts` | one at its own layer, one asserted case per decision row, every rejected input its own member | yes - 14/14 route rows C1-C14, 4+2+3 copy variants C29-C34, 6+3 error classes C35-C41; rejected inputs named individually at `membership-errors.test.ts:56-61` |
| Decides, behind a platform module the node harness cannot load | none in this diff - the artifact's own evidence assigns `lib/pending-invite.ts` to row 3 | - | yes, vacuously - the row classifies no file here, so there is nothing for it to require |
| Module-scoped mutable state with a persisted mirror | `lib/pending-invite.ts` | one per transition and one per read path; empty, written, overwritten, cleared, recovered, both storage calls failing | yes - all six listed states have a proof (see Coverage), and both read paths are asserted: `getPendingInviteSnapshot` at `:90`/`:126`/`:213`, `readPendingInvite` at `:61`/`:70`/`:179` |
| A screen in a package with no renderer | `app/(app)/index.tsx`, `app/(onboarding)/user-type.tsx`, `app/(app)/(joining)/academy/[academyId].tsx`, `app/(app)/(joining)/already-member.tsx` | no proof at its own layer; every decision moved into a pure module; the wiring carries a named manual pass with its expected observation | yes - route to `lib/gatekeeper.ts`, headline to `lib/invite-copy.ts`, sentences to `lib/membership-errors.ts`, and M1-M9 each state an expected observation. One residue noted below: `already-member.tsx:46-48` keeps a two-variant sentence inline; M9 names its observation, which is what the row permits |
| Instrumentation - a re-export, a hook into a store, a `useQuery` wrapper | `lib/hooks/use-pending-invite.ts`, `lib/api.ts#getPublicAcademy`, `lib/hooks/use-academy.ts#usePublicAcademy`, **and `lib/api.ts`'s `export { ApiError }`** | none of its own; covered by its consumer's proof | the first three: yes - the hook's store is C17-C27, and `getPublicAcademy` -> `usePublicAcademy` -> the headline is observed end to end by M2. The `ApiError` re-export: **not met** - its consumers are ten screens with no proof, and the two gate steps that would have caught it are `echo` stubs |

## Faults injected

Baseline `git status --porcelain` of the real tree: **empty**. Isolation:
`git worktree add <scratchpad>/mutant HEAD` with the workspace `node_modules` symlinked in; no
`git stash` at any point. After `git worktree remove --force`, the real tree's porcelain is
**empty again - matches the baseline**.

One fault per distinct assertion surface, five surfaces, five faults.

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| `invite.academyId !== activeMembership.academyId` -> `===` (invite-elsewhere test inverted) | `lib/gatekeeper.ts:118` | `-t "sends someone invited elsewhere to the already-a-member screen"` | yes - 1 failed, 15 skipped |
| dropped the role whitelist: `typeof role !== "string" \|\| !PERSISTABLE_ROLES.has(role)` -> `typeof role !== "string"` | `lib/pending-invite.ts:100` | `-t "refuses every unusable persisted value"` | yes - 1 failed, 12 skipped |
| headline fallback `"nesta academia"` -> `"na academia"` | `lib/invite-copy.ts:36` | `-t "names the role when the academy has no name yet"` | yes - 1 failed, 6 skipped |
| flipped the 409 split: `return hasMembership` -> `return !hasMembership` | `lib/membership-errors.ts:38` | `-t "tells a member of another academy to leave it first"` | yes - 1 failed, 8 skipped |
| re-introduced the removed destination: `router.replace("/(app)")` -> `router.replace("/(app)/(joining)/pending-approval")` | `app/(app)/(joining)/academy/[academyId].tsx:45` | `-t "leaves the destination to the gatekeeper"` | yes - 1 failed, 8 skipped |

The fifth fault exists to test the **source-text assertion** surface the brief flagged, and it
settles it: C43's `not.toContain("(joining)/pending-approval")` is non-vacuous and precise enough
that the word `pending-approval` sitting in a code comment two lines above (`:43`) does not trip it.

## Source-text assertions - judgement

The brief asked for a verdict on three checks that assert bytes rather than behaviour. All three
are non-vacuous (each was or could be made to fail), and all three are narrower than the criterion
they carry. None is a vacuous pass; all three are recorded as precision gaps.

- **C16** (`gatekeeper.test.ts:268-293`). Settles AC 17 for `app/` and `lib/` only; the walk never
  enters `components/`, `constants/` or `scripts/`, so an importer there would satisfy the check
  and violate the criterion. I swept the whole of `apps/mobile` by hand -
  `grep -rn "lib/gatekeeper" --include="*.ts" --include="*.tsx"` returns `app/(app)/index.tsx:1`
  plus the test file's own two lines. **Criterion met; scope of the check is narrower than the
  criterion.**
- **C34's second proof** (`invite-copy.test.ts:72-81`). Asserts the screen has no
  **double-quoted** `"Aluno"` / `"Instrutor"` / `"Responsável"`; a single-quoted literal or a bare
  JSX text node would slip past, and the claim says "any of the three literals". I read
  `app/(onboarding)/user-type.tsx` in full: the three labels appear only as `ROLE_LABELS.instructor`
  / `.student` / `.guardian` (`:18`, `:25`, `:31`). **Criterion met; assertion weaker than the
  claim.**
- **C43** (`membership-errors.test.ts:128-133`). Asserts only the *absence* of the old destination.
  AC 44's positive half - "replace to `/(app)` for **both** the `pending` and the `active` response
  status" - is asserted by nothing; the check would pass if the screen replaced to a role home
  instead. `academy/[academyId].tsx:40-46` has a single unconditional `router.replace("/(app)")`
  in `onSuccess`, and M4 names the observation. **Criterion met; half of it is proven only by
  reading the file and by the manual pass.**

## C27 / C28 - did TAT-177 lose anything?

No. `git diff` of both test files across the range: `app/+native-intent.test.ts` gains the
AsyncStorage double and changes four `clearPendingInvite()` calls to `void clearPendingInvite()`
(the function became `async`); **every one of its six tests and every assertion is untouched**, and
the clear is still synchronous in its visible effect because `emit()` runs before the `await`.
`lib/pending-invite.test.ts` keeps all three TAT-177 tests with identical assertions
(`:61`, `:70-71`, `:77`); the only edits are `async`/`await` on the clear and factoring
`vi.resetModules()` into `freshStore()`. Nothing was weakened and nothing deleted.

## Swept rows resolving to `existing`

Read against the code, not accepted as prose. The `authorization` row is accurate:
`apps/api/src/modules/membership/membership.routes.ts:97-98` is
`"/requests", authorize(Role.Instructor, Role.Student, Role.Guardian)` and `:105` takes
`const role = req.appAuth!.role`; `apps/api/src/modules/academy/academy.routes.ts:57` is
`get("/:academyId", requireSession, …)` and `:80` `get("/:academyId/public", …)` carries no guard,
which is what makes the headline lookup legal before a membership exists. The `observability`
row's `n/a` is policy, and the API side is untouched in this range. One extra contract check:
`PublicAcademy` in `lib/api.ts` declares `{ id, name, logoUrl }` and
`academy.service.ts:54` returns exactly `{ id: row.id, name: row.name, logoUrl: row.logoUrl }`.

## Minor notes (not verdict-bearing)

- **C15 understates its own proof.** The claim says "none of the 48"; the test enumerates
  `2 * 5 * 2 * 4 * 3 = 240`. Over-coverage, recorded so the next reader is not confused.
- **The `typeof role !== "string"` guard is redundant, not unproven.**
  `PERSISTABLE_ROLES` is a `Set<string>`, so `has(7)` is already `false` and the module returns
  `null` with or without the guard. No mutant hides there, which is why the 7-row table is
  complete rather than missing a non-string-role member.
- **`already-member.tsx:46-48`** keeps a two-variant sentence (with and without
  `activeMembership.academyName`) inline rather than in `lib/invite-copy.ts`. No AC covers that
  copy and M9 names the observation, so it is within Test policy row 4 - but it is the one
  decision in this feature that did not move into a pure module.

## Gate

- `pnpm turbo run test --force` - **972 passed, 0 failed** (8/8 tasks): 873 API across 58 files
  (134 integration), 30 web, **69 mobile across 7 files**, up from 27.
- `pnpm turbo run lint --force` - 8/8 tasks, **0 errors**, 5 warnings, all pre-existing in
  `apps/web` (`components/ui/beams-background.tsx`, `react-hooks/*`). `apps/mobile` is not linted:
  its script is `echo 'no lint configured'`.
- `pnpm turbo run typecheck --force` - 13/13 tasks clean. `apps/mobile`'s task is
  `echo 'skipped: …'`; run by hand, `tsc --noEmit` gives the same **5 pre-existing** errors, none
  in a touched file.
- `git diff --quiet <base> -- "apps/mobile/app/(app)/(guardian)/(home)/index.tsx"` - exit `0`.

## Ranked gaps

1. **Door 6 has no check, and the gate cannot stand in for one.** `plan.md` `## Landing` row 6
   requires `export { ApiError } from "@/lib/api-error";` in `lib/api.ts` so that every existing
   `import { ApiError } from "@/lib/api"` keeps working. `checks.md` has no check for it (its
   header says "5 one-way doors" and its Coverage prose lists doors 1-5), no mobile test imports
   `ApiError` from `@/lib/api`, and `apps/mobile`'s `lint` and `typecheck` scripts are both `echo`
   stubs - so removing the line is invisible to the whole gate.
   `apps/mobile/lib/api.ts:4`, `apps/mobile/package.json:10`.
   *Smallest fix:* one check asserting the re-export - e.g. `expect(await import("@/lib/api"))` is
   impossible under `environment: "node"` (that file imports `@clerk/clerk-expo`), so assert the
   bytes instead, the same technique C16/C43 already use: `lib/api.ts` contains
   `export { ApiError } from "@/lib/api-error"`. Add the door-6 row to `Coverage` and correct the
   "5 one-way doors" count.
2. **C43 proves only half of AC 44** - the absence of the old destination, never the presence of
   `router.replace("/(app)")` for both response statuses.
   `apps/mobile/lib/membership-errors.test.ts:132`.
3. **C34's second proof is weaker than its claim** - it rejects only double-quoted role labels, so
   a single-quoted literal or a JSX text node would pass a check whose claim is "any of the three
   literals". `apps/mobile/lib/invite-copy.test.ts:79`.
4. **C16 sweeps `app/` and `lib/` only**, while AC 17 says `app/(app)/index.tsx` is the *only*
   importer; `components/`, `constants/` and `scripts/` are outside the walk.
   `apps/mobile/lib/gatekeeper.test.ts:289-290`.
