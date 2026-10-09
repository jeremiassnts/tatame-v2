# TAT-178 — Manager share and invite actions · verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: `79592ec..eff3752`
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

No design was binding: `plan.md`'s `## Sources` names no `design.pen` screen and no artifact URL,
so step 1's `## Binding sources` section is not owed at this profile. The two **code** locations it
does mark binding were opened and compared: `packages/types/src/index.ts:17-48` (the `papel`
vocabulary and its exact-match rule — `aluno`/`instrutor`/`responsavel`, no aliases, no case
folding) and `apps/web/app/baixar/page.tsx:7-18` (`/baixar` is the download page, deliberately not
the apex). Neither contradicts a check: `buildInviteUrl` emits exactly the three tokens
`PAPEL_TO_ROLE` accepts, and `APP_DOWNLOAD_URL` is exactly `/baixar`. I also opened the two
*parsers* the plan says must keep agreeing — `apps/web/lib/invite.ts:1-21` and
`apps/web/app/convite/[academyId]/page.tsx:65-71` — and the produced shape
`/convite/<academyId>?papel=<token>` is the shape that page reads.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | three options in order, labelled from `ROLE_LABELS` | `vitest run lib/invite-share.test.ts -t "lists the three roles in order"` exit 0 | `apps/mobile/lib/invite-share.test.ts:50` - `expect(INVITE_ROLE_OPTIONS.map((o) => o.role)).toEqual(["student","instructor","guardian"])`; `:55` - `expect(INVITE_ROLE_OPTIONS.map((o) => o.label)).toEqual(["Aluno","Instrutor","Responsável"])` | PARTIAL - order and labels settled; the clause "from `ROLE_LABELS` rather than from a second copy" is not asserted anywhere: the test hardcodes the same three strings, so an implementation that inlined `"Aluno"` instead of `ROLE_LABELS.student` passes |
| C2 | url per role, and it parses back | `-t "builds the invite url for each role"` exit 0 · `-t "every url it builds is one parseInviteLink accepts"` exit 0 | `apps/mobile/lib/invite-share.test.ts:92` - `expect(buildInviteUrl("acad-1","guardian")).toBe("https://apptatame.com.br/convite/acad-1?papel=responsavel")`; `:109` - `expect(parseInviteLink(url), role).toEqual({ academyId: "acad-42", role })` over all three roles | PASS |
| C3 | guardian description names the adult, cadastrar, dependente | `-t "the guardian option explains it invites the adult"` exit 0 | `apps/mobile/lib/invite-share.test.ts:71-73` - `expect(description).toContain("responsável")` · `toContain("cadastra")` · `toContain("dependente")` | PASS |
| C4 | header actions only under `showInviteActions`, default `false`; only the manager list passes it | `-t "only the manager members list asks for the invite actions"` exit 0 | `apps/mobile/lib/invite-share.test.ts:322` - `expect(read(MEMBERS_LIST)).toContain("showInviteActions = false")`; `:323` - `toContain("showInviteActions ?")`; `:326` - `expect(read(INSTRUCTOR_MEMBERS)).not.toContain("showInviteActions")` | FAIL - the only assertion about the gate is that the substring `showInviteActions ?` occurs *somewhere* in the file. It occurs twice (`MembersListContent.tsx:123` header, `:210` modal), so deleting or inverting the header one leaves the substring present. Fault F4 flipped `:123` to `!showInviteActions ?` — AC 4 exactly inverted, instructor and student lists rendering both actions and the manager list rendering none — and all 29 tests still passed |
| C5 | `APP_DOWNLOAD_URL` is `/baixar`; app message carries it, no `/convite/`, not the apex | `-t "the app message points at the download page"` exit 0 | `apps/mobile/lib/invite-share.test.ts:146` - `expect(APP_DOWNLOAD_URL).toBe("https://apptatame.com.br/baixar")`; `:152` - `expect(APP_SHARE_MESSAGE).not.toContain("/convite/")`; `:151` - `expect(APP_SHARE_MESSAGE.endsWith("https://apptatame.com.br")).toBe(false)` | PASS |
| C6 | `dismissedAction` reports zero times, no throw | `-t "a dismissed sheet reports nothing"` exit 0 | `apps/mobile/lib/invite-share.test.ts:213` - `await expect(shareMessage("hello", share, reportError)).resolves.toBeUndefined()`; `:217` - `expect(reportError).not.toHaveBeenCalled()` (share stub resolves `{ action: "dismissedAction" }` at `:210`) | PASS |
| C7 | a rejection reports exactly once, title `Erro`, accented body | `-t "a failed share raises one Portuguese alert"` exit 0 | `apps/mobile/lib/invite-share.test.ts:228` - `expect(reportError).toHaveBeenCalledTimes(1)`; `:230` - `expect(title).toBe("Erro")`; `:231` - `expect(body).toMatch(ACCENTED)` | PASS |
| C8 | the picker is a `Modal` over `SelectionCard` with `visible`/`onClose`/`onSelect`, no `ModalSelect` | `-t "the picker follows the DependentSelectionModal shape"` exit 0 | `apps/mobile/lib/invite-share.test.ts:336-340` - `expect(sheet).toContain("<Modal")` · `toContain("visible")` · `toContain("onClose")` · `toContain("onSelect")` · `toContain("<SelectionCard")`; `:343` - `expect(sheet).not.toContain("ModalSelect")` | PASS (substring-level: the three prop names are matched as bare words, so the assertion proves the names occur, not that they are `Modal`'s props) |
| C9 | `sharedAction` reports zero times | `-t "a completed share reports nothing"` exit 0 | `apps/mobile/lib/invite-share.test.ts:205` - `expect(share).toHaveBeenCalledWith({ message: "hello" })`; `:206` - `expect(reportError).not.toHaveBeenCalled()` | PASS |
| C10 | `Ações rápidas` holds exactly five cards | `-t "the manager home has five quick actions"` exit 0 | `apps/mobile/lib/invite-share.test.ts:362` - `const cards = read(MANAGER_HOME).split(QUICK_ACTION_CARD).length - 1; expect(cards).toBe(5)` | PASS - independently recounted in the source: the card `className` occurs at `app/(app)/(manager)/(home)/index.tsx:294,309,330,345,362` |
| C11 | the fifth card's label is `INVITE_QUICK_ACTION_LABEL` and its handler the picker opener, not its own `Share.share` | `-t "the fifth quick action opens the shared picker"` exit 0 | `apps/mobile/lib/invite-share.test.ts:370-372` - `expect(home).toContain("INVITE_QUICK_ACTION_LABEL")` · `toContain("invite.openPicker")` · `toContain("InviteRoleSheet")`; `:374` - `expect(home).not.toContain("Share.share")` | PARTIAL - the "no own `Share.share`" half is settled. The attribution half is not: `invite.openPicker` occurs twice in the file (`:281` welcome card, `:361` quick action) and the assertion cannot tell which card carries it, so a fifth card wired to `invite.shareApp` would pass |
| C12 | `shouldShowInviteWelcome(undefined)` is `false` | `-t "no member count means no card"` exit 0 | `apps/mobile/lib/invite-share.test.ts:247` - `expect(shouldShowInviteWelcome(undefined)).toBe(false)` | PASS |
| C13 | true at `1`/`4`, false at `5`/`30`, threshold `=== 5` | `-t "the card lives below five active members"` exit 0 | `apps/mobile/lib/invite-share.test.ts:251` - `expect(INVITE_WELCOME_MEMBER_THRESHOLD).toBe(5)`; `:256-257` - `expect(shouldShowInviteWelcome(4)).toBe(true)` · `expect(shouldShowInviteWelcome(5)).toBe(false)` | PASS |
| C14 | card renders before `Ações rápidas`, gated on the predicate; the card wires both presses | `-t "the welcome card sits above the quick actions and offers both actions"` exit 0 | `apps/mobile/lib/invite-share.test.ts:387` - `expect(cardAt).toBeLessThan(headingAt)`; `:391` - `expect(home).toContain("shouldShowInviteWelcome(stats?.activeMembers)")`; `:394-397` - `expect(card).toContain("onInvitePress")` · `toContain("onShareAppPress")` · `toContain("INVITE_LABEL")` · `toContain("SHARE_APP_LABEL")` | PASS (the four `toContain`s prove both props and both labels are named in `InviteWelcomeCard.tsx`, not which `Pressable` each is attached to) |
| C15 | invite message carries the name, the url, an accent, group wording | `-t "the invite message names the academy and speaks to a group"` exit 0 | `apps/mobile/lib/invite-share.test.ts:163-170` - `expect(message).toContain("Academia Alpha")` · `toContain(url)` · `toMatch(ACCENTED)` · `toContain("para todos")` · `expect(message.toLowerCase()).toContain("compartilh")` | PASS |
| C16 | `""`/`null`/`undefined` give the no-academy phrasing, keep the url, no artefacts | `-t "an unnamed academy loses the name, not the sentence"` exit 0 | `apps/mobile/lib/invite-share.test.ts:179-186` - over `["", "   ", null, undefined]`: `expect(message).toContain(url)` · `toContain("nossa academia")` · `not.toContain("undefined")` · `not.toContain("  ")` · `not.toContain(" .")` | PASS |
| C17 | no entry point holds its own copy of either message; each sharer goes through the module | `-t "no screen keeps its own copy of a message"` exit 0 | `apps/mobile/lib/invite-share.test.ts:412-415` - over the four files: `expect(source).not.toContain(inviteFragment)` · `not.toContain(appFragment)` · `not.toContain("apptatame.com.br")`; `:420` - `expect(read(file)).toContain("useInviteShare")` | PASS - precision note: the claim says each sharer "imports from `@/lib/invite-share`", the assertion matches `useInviteShare`, which lives in `@/lib/hooks/use-invite-share` |
| C18 | `ROLE_TO_PAPEL` has exactly the three `InviteRole` keys and round-trips | `-t "every role round-trips through its papel token"` exit 0 | `apps/mobile/lib/invite-share.test.ts:126` - `expect(Object.keys(ROLE_TO_PAPEL).sort()).toEqual([...ROLES].sort())`; `:129` - `expect(resolvePapelToRole(ROLE_TO_PAPEL[role]), role).toBe(role)` for all three | PASS |
| C19 | every new label constant is ≤16 chars per line | `-t "every new button label fits a mobile button"` exit 0 | `apps/mobile/lib/invite-share.test.ts:269` - `expect(line.length, line).toBeLessThanOrEqual(16)` over `[INVITE_LABEL, SHARE_APP_LABEL, INVITE_QUICK_ACTION_LABEL]` split on `\n` | PASS |
| C20 | the hook is the only importer of `Share` under `app`/`components`/`lib` | `-t "one hook is the only importer of Share"` exit 0 | `apps/mobile/lib/invite-share.test.ts:437` - `expect(importers).toEqual(["lib/hooks/use-invite-share.ts"])`, where `importers` is every `.ts(x)` file under `app`, `components`, `lib` whose `import { … } from "react-native"` names `Share` (`:428-435`) | PASS (the regex sees only the named-import form; `import * as RN` would evade it, which is a shape `react-native` consumers here never use) |
| C21 | `lib/invite-share.ts` imports nothing from `react-native` | `-t "the share module stays pure"` exit 0 | `apps/mobile/lib/invite-share.test.ts:280` - `expect(read("lib/invite-share.ts")).not.toContain("react-native")` | PASS as written - but `checks.md` labels this check "(door 2)" and the `Coverage` row joins door 2 to it; door 2 is `Share.share({ message })` with no `url` key, which this assertion says nothing about (see `## Coverage`) |
| C22 | `description` is optional and `DependentSelectionModal` passes none | `-t "the check-in sheet passes no description"` exit 0 | `apps/mobile/lib/invite-share.test.ts:446-449` - `expect(card).toContain("description?: string;")` · `toContain("Icon = User")` · `expect(read(DEPENDENT_SHEET)).not.toContain("description")` | PASS |

Every `-t` name in `checks.md` was confirmed to match a test that exists and ran: one batched
invocation with `--reporter=verbose` printed all 29 test names individually, 29 passed. All 22
checks resolve to tests created by this feature (`apps/mobile/lib/invite-share.test.ts` is new in
`eff3752`), so none is a pre-existing test standing in for new behaviour.

## Coverage

Recomputed from the authority over each set, not read back from `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `InviteRole` -> `papel` token (3) | `packages/types/src/index.ts:13` (`Exclude<Role,"manager">`) and `:28-48` | `student` C18, C2 · `instructor` C18, C2 · `guardian` C18, C2 | - |
| role picker rows (3) | plan AC 1 + `apps/mobile/lib/invite-copy.ts:16-20` (`ROLE_LABELS`) | `Aluno` C1 · `Instrutor` C1 · `Responsável` C1, C3 | that the three labels are *read from* `ROLE_LABELS` - C1 asserts the same three literals the module could inline |
| entry points (3) | plan `Flow` 1 and AC 1, 9, 14 | members header C4 · home quick action C10, C11 · welcome card C14 | the members-header member: its gate's polarity and position (`MembersListContent.tsx:123`) - fault F4 survived |
| share actions (2) | plan AC 2, AC 5 | invite C2, C15 · share-app C5 | - |
| `MembersListContent` consumers (3) | `grep -rl` over `apps/mobile/app` - exactly `(manager)`, `(instructor)`, `(student)` `(members)/index.tsx` | manager C4 · instructor C4 · student C4 | - |
| share-sheet outcomes (3) | the `react-native` `Share.share` contract (resolve `sharedAction` / resolve `dismissedAction` / reject) | `sharedAction` C9 · `dismissedAction` C6 · rejection C7 | - (noted: `shareMessage` does not branch on `action`, so C6 and C9 exercise one code path twice) |
| welcome-card threshold edges (4) | plan AC 11, 12, 13 | no data C12 · `1` C13 · `4` C13 · `5` C13 | - |
| new button labels (3) | `apps/mobile/lib/invite-share.ts:106,107,109` | `Convidar` C19 · `Compartilhar app` C19 · `Convidar\nmembro` C19 | - |
| message definitions (2) | `apps/mobile/lib/invite-share.ts:81` and `:91` | invite C15, C16, C17 · app C5, C17 | - |
| academy-name states in the invite message (4) | `apps/mobile/lib/academy-context.tsx:19` (`academyName: ""`) + plan AC 17 | named C15 · `""` C16 · `null` C16 · `undefined` C16 | - (C16 also covers `"   "`) |
| one-way doors (3) | plan `Landing` | door 1 C18 · door 2 **mis-joined** · door 3 C20 | door 2: the row credits C21, which asserts that `lib/invite-share.ts` imports no `react-native` - a different claim. Door 2's literal shape (`Share.share({ message })`, one string, no `url` key) is in fact asserted at `apps/mobile/lib/invite-share.test.ts:205` (`toHaveBeenCalledWith({ message: "hello" })`) and `:240` (`expect(source).not.toMatch(/url\s*:/)` over the hook) - but `:240` belongs to a test no check names, so the door is proven by an unclaimed assertion while its named proof proves something else |
| `Ações rápidas` cards (5) - *no row in `checks.md`* | `app/(app)/(manager)/(home)/index.tsx:294,309,330,345,362` | count C10 · the new card C11 | - (the four pre-existing cards are outside this diff) |
| role row glyphs (3) - *no row in `checks.md`* | plan `Impact`: "the three role rows need a sentence each and **three different glyphs**" | none | all three: nothing asserts `ROLE_ICONS` (`components/InviteRoleSheet.tsx:18-22`) maps the three roles to three distinct icons, nor that `SelectionCard` renders the `Icon` it is handed (`components/SelectionCard.tsx:75` substituted `User` for `Icon`) |
| `SelectionCard` sub-line precedence (2) - *no row in `checks.md`* | `components/SelectionCard.tsx:84-88` - the new `description ? … : beltSub ? …` chain | `description` none · `beltSub` none | both: C22 proves only that the prop is optional and that `DependentSelectionModal` passes none. A row carrying both a description and a belt now silently loses the belt, and no assertion sees it |

No set claims a status code, a route or a response shape, so there is no level gap to find: plan
`Surface` is `None - nothing consumed outside`, this feature issues no request and adds no route,
and the two URLs it emits are `apps/web` routes verified above. There is no
startup-configuration set — nothing here runs before the first request.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, and the decision is reachable from more than one screen | `apps/mobile/lib/invite-share.ts` | own layer, in a module importing no `react-native` (C21), one case per decision-table row plus every boundary edge | yes - 3 roles C1/C2, boundary `4`/`5` both sides plus `1`/`30`/`undefined` C12/C13, 3 falsy names plus `"   "` C16, three terminal share outcomes C6/C7/C9 |
| Decides, reached from one screen only | no file - the `Evidence` list classifies none in this class | - | n/a |
| Instrumentation that wires a decision module to a screen | `app/(app)/(manager)/(home)/index.tsx`, `lib/hooks/use-invite-share.ts` | one source-text assertion that the wiring exists and that no second copy of the decision does | no - met for the home screen (C11, C14, C17) and **not met for `lib/hooks/use-invite-share.ts`**. The row demands "the import, and the absence of a duplicate"; only the absence is asserted (C20, and `:240`). Nothing asserts the hook imports or calls `shareMessage`, `inviteShareMessage`, `buildInviteUrl` or `APP_SHARE_MESSAGE` (`lib/hooks/use-invite-share.ts:45,51-52`), so the one module every entry point shares could pass the app message where the invite message belongs, or never call `shareMessage` at all, with all 29 tests green |
| Pure presentation - maps a prop onto a view with no conditional | `components/InviteRoleSheet.tsx`, `components/InviteWelcomeCard.tsx` | none of its own | yes - and both carry a source-text assertion anyway (C8, C14) |
| *unclassified* | `components/SelectionCard.tsx` | - | no - the `Evidence` list omits it. It gained a conditional (`:84-88`) and is reached from two consumers, which puts it in the first row; that row demands a proof at its own layer and it has none |

## Faults injected

Isolation: `git worktree add` at `HEAD` into the scratchpad, with `node_modules` wired in by
symlink and `packages/types` rebuilt **inside the scratch** (confirmed effective — F1 mutates
`packages/types` and the scratch suite saw it). The real tree was never mutated: baseline
`git status --porcelain` was empty before and is empty after, the scratch worktree was removed, and
the four mutated files were diffed byte-for-byte against the real tree before removal.

| Mutation | Location | Killed |
| --- | --- | --- |
| `ROLE_TO_PAPEL.guardian` `"responsavel"` -> `"responsável"` (door 1) | `packages/types/src/index.ts:48` | yes - 4 failed / 25 passed: both C2 proofs and both `papel`-table tests |
| threshold comparison `<` -> `<=` | `apps/mobile/lib/invite-share.ts:160` | yes - 1 failed: C13 |
| `reportError(SHARE_ERROR_TITLE, SHARE_ERROR_BODY)` removed from the `catch` | `apps/mobile/lib/invite-share.ts:136` | yes - 1 failed: C7 |
| header gate condition flipped: `{showInviteActions ? (` -> `{!showInviteActions ? (` | `apps/mobile/components/MembersListContent.tsx:123` | no - 29 passed, 0 failed. AC 4 inverted (instructor and student lists show both actions; the manager list shows none) and nothing fails |
| `<InviteWelcomeCard>` block moved below the `Ações rápidas` heading | `apps/mobile/app/(app)/(manager)/(home)/index.tsx:279-284` | yes - 1 failed: C14 |

Four of five killed; one surviving mutant. Capped at five per the profile.

## Gate

`pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts --reporter=verbose` - 29
passed, 0 failed (all 22 checks' named tests shown individually).
`pnpm --filter @tatame/mobile test` - 9 files, 100 passed, 0 failed.
`npx tsc --noEmit` in `apps/mobile` - 5 errors, all in
`(manager)/(members)/[membershipId].tsx`, `(student)/register-belt.tsx`, `app/_layout.tsx` and
`components/DependentSelectionModal.tsx`: the same five `.specs/STATE.md` records, none in a file
this feature wrote.

## Ranked gaps

1. **AC 4 is not actually proven — surviving mutant.** `components/MembersListContent.tsx:123` —
   C4's only gate assertion is `expect(read(MEMBERS_LIST)).toContain("showInviteActions ?")`
   (`apps/mobile/lib/invite-share.test.ts:323`), and that substring occurs twice in the file, so
   neither deleting nor inverting the header gate fails anything. Flipping it to
   `!showInviteActions ?` left 29/29 green. A proof that distinguishes the two occurrences is
   needed — e.g. assert the header block's own text, or assert on the slice between the title and
   the search box.
2. **The single share hook has no wiring proof — `Test policy` row 3 unmet.**
   `apps/mobile/lib/hooks/use-invite-share.ts:45,51-52` — no assertion anywhere reads this file for
   the wiring (only for the *absence* of `url:` and for being the sole `Share` importer), so
   `shareApp` sharing the invite message, or `selectRole` never calling `shareMessage`, is invisible
   to the suite. This is the module both other entry points depend on.
3. **Door 2's `Coverage` row is mis-joined.** `checks.md` labels C21 "(door 2)" and the `Coverage`
   table credits door 2 to it, but C21 asserts module purity
   (`apps/mobile/lib/invite-share.test.ts:280`). Door 2's real assertions live at `:205` and `:240`,
   and `:240` belongs to a test no check claims. Either relabel C21 as door 2's enabler and give
   door 2 its own check, or point the row at `:205`/`:240`.
4. **C1's single-source clause is unasserted.** `apps/mobile/lib/invite-share.test.ts:55` compares
   against the same three literals the module could inline, so "labelled from `ROLE_LABELS` rather
   than from a second copy" has no proof. Assert against `ROLE_LABELS` itself.
5. **C11 cannot attribute the handler to the fifth card.**
   `apps/mobile/lib/invite-share.test.ts:371` — `invite.openPicker` occurs at both
   `(home)/index.tsx:281` and `:361`, so a fifth card wired to the wrong handler passes.
6. **`components/SelectionCard.tsx` is unclassified by the `Test policy` evidence and its new
   conditional is unproven.** `components/SelectionCard.tsx:84-88` — the `description` branch now
   precedes `beltSub`, and nothing asserts the precedence; C22 proves only optionality and that the
   check-in sheet passes none. No live regression today (its other consumer passes no description),
   but the row owes a classification.
7. **Two enumerations the plan names got no `Coverage` row and no proof.** The three role glyphs
   (plan `Impact`: "three different glyphs"; `components/InviteRoleSheet.tsx:18-22`) and that
   `SelectionCard` renders the `Icon` it is handed (`components/SelectionCard.tsx:75`).

Open question 1 in `plan.md` (a store build exercised on a real iOS and Android device) remains
open and blocks go-live, not the checks.
