# TAT-178 — Manager share and invite actions · verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: `79592ec..0b6e91e`
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scoped by the fix's diff (`eff3752..0b6e91e`) plus every round-1 verdict that was not PASS.
Everything else is marked `carried from eff3752` in its own section. Proofs re-ran in full at the
new `HEAD`.

**Round-1 gaps, re-judged:** gap 1 (AC 4's gate) **closed** — two independent mutations of that
gate are now killed. Gaps 3, 4, 5, 6 and 7 **closed**. Gap 2 (the hook's wiring) is *partly*
closed: C23 now pins the two message definitions, but the hook's **call sites** are still
unasserted and a mutation there survives. Two new surviving mutants, both on surfaces the fix
touched or created.

**The fix's own claims, checked rather than taken:**

- `checks.md` claims C1–C22 are unchanged. True: the only lines the commit removes from
  `checks.md` are the header count, three `Coverage` rows (re-pointed), and the `Cost` line
  (`git diff eff3752..HEAD -- …/checks.md | grep '^-'` → 5 lines, none inside a C1–C22 block).
- "No assertion was weakened and no test was deleted or skipped." True: the commit removes exactly
  three lines from `lib/invite-share.test.ts` — `/** C22 */` and two file-wide
  `expect(home).toContain(…)` calls in C11's test, both strictly implied by their replacements
  (`occurrences(quickActions, X) === 1` over a slice of `home`). 33 `it(` blocks, 33 ran, no
  `.skip`/`.only`/`.todo` anywhere.
- `checks.md`'s `## Handoff` was **not** updated: it still reads "C1-C22 closed. All 22 proofs
  green … (29 tests); the mobile suite went 71 -> 100 tests". It is 26 checks, 33 tests, 104.
  Stale prose, not a proof gap.

**Binding sources** — *carried from eff3752*. No design was binding: `plan.md`'s `## Sources` names
no `design.pen` screen and no artifact URL, so step 1's section is not owed at this profile. The
two binding **code** locations (`packages/types/src/index.ts:17-48`,
`apps/web/app/baixar/page.tsx:7-18`) were opened in round 1 and neither is in the fix's diff, so
nothing to re-compare; no contradiction, nothing uncovered.

## Checks — *verified at 0b6e91e*

All 26 proofs re-run at `HEAD` in one batched invocation with `--reporter=verbose`: every test name
printed individually, **33 passed, 0 failed**. Each of the 26 `-t` names in `checks.md` was
confirmed against a test that exists and ran. Citations are refreshed — the fix edited
`lib/invite-share.test.ts`, so every line number moved.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | three options in order, labelled *from* `ROLE_LABELS` | `-t "lists the three roles in order"` exit 0 | `apps/mobile/lib/invite-share.test.ts:51` - `expect(INVITE_ROLE_OPTIONS.map((o) => o.role)).toEqual(["student","instructor","guardian"])`; `:66-68` - `expect(module).toContain("ROLE_LABELS.student")` (and `.instructor`, `.guardian`); `:70` - `expect(module, label).not.toContain(label)` over `Object.values(ROLE_LABELS)` | PASS - round-1 gap 4 closed: the sourcing clause is now asserted from both sides (the reads are present, the literals are absent) |
| C2 | url per role, and it parses back | `-t "builds the invite url for each role"` · `-t "every url it builds is one parseInviteLink accepts"` exit 0 | `apps/mobile/lib/invite-share.test.ts:104` - `expect(buildInviteUrl("acad-1","guardian")).toBe("https://apptatame.com.br/convite/acad-1?papel=responsavel")`; `:121` - `expect(parseInviteLink(url), role).toEqual({ academyId: "acad-42", role })` over all three roles | PASS |
| C3 | guardian description names the adult, cadastrar, dependente | `-t "the guardian option explains it invites the adult"` exit 0 | `apps/mobile/lib/invite-share.test.ts:83-85` - `expect(description).toContain("responsável")` · `toContain("cadastra")` · `toContain("dependente")` | PASS |
| C4 | header actions only under `showInviteActions`, default `false`; only the manager list passes it | `-t "only the manager members list asks for the invite actions"` exit 0 | `apps/mobile/lib/invite-share.test.ts:352` - `expect(read(MEMBERS_LIST)).toContain("showInviteActions = false")`; `:356` - `expect(read(INSTRUCTOR_MEMBERS)).not.toContain("showInviteActions")`; `:357` - same for the student list | PASS - the prop plumbing. The *gate* is now C26's job, which is what closes round-1 gap 1 |
| C5 | `APP_DOWNLOAD_URL` is `/baixar`; app message carries it, no `/convite/`, not the apex | `-t "the app message points at the download page"` exit 0 | `apps/mobile/lib/invite-share.test.ts:158` - `expect(APP_DOWNLOAD_URL).toBe("https://apptatame.com.br/baixar")`; `:164` - `expect(APP_SHARE_MESSAGE).not.toContain("/convite/")`; `:163` - `expect(APP_SHARE_MESSAGE.endsWith("https://apptatame.com.br")).toBe(false)` | PASS |
| C6 | `dismissedAction` reports zero times, no throw | `-t "a dismissed sheet reports nothing"` exit 0 | `apps/mobile/lib/invite-share.test.ts:225` - `await expect(shareMessage("hello", share, reportError)).resolves.toBeUndefined()`; `:229` - `expect(reportError).not.toHaveBeenCalled()` (stub resolves `{ action: "dismissedAction" }` at `:222`) | PASS |
| C7 | a rejection reports exactly once, title `Erro`, accented body | `-t "a failed share raises one Portuguese alert"` exit 0 | `apps/mobile/lib/invite-share.test.ts:240` - `expect(reportError).toHaveBeenCalledTimes(1)`; `:242` - `expect(title).toBe("Erro")`; `:243` - `expect(body).toMatch(ACCENTED)` | PASS |
| C8 | the picker is a `Modal` over `SelectionCard` with `visible`/`onClose`/`onSelect`, no `ModalSelect` | `-t "the picker follows the DependentSelectionModal shape"` exit 0 | `apps/mobile/lib/invite-share.test.ts:386-390` - `expect(sheet).toContain("<Modal")` · `toContain("visible")` · `toContain("onClose")` · `toContain("onSelect")` · `toContain("<SelectionCard")`; `:393` - `not.toContain("ModalSelect")` | PASS (substring-level: the three prop names are matched as bare words) |
| C9 | `sharedAction` reports zero times | `-t "a completed share reports nothing"` exit 0 | `apps/mobile/lib/invite-share.test.ts:217` - `expect(share).toHaveBeenCalledWith({ message: "hello" })` (exact object - an added `url` key fails here, which is what makes this door 2's proof); `:218` - `expect(reportError).not.toHaveBeenCalled()` | PASS |
| C10 | `Ações rápidas` holds exactly five cards | `-t "the manager home has five quick actions"` exit 0 | `apps/mobile/lib/invite-share.test.ts:414` - `expect(cards).toBe(5)` over `read(MANAGER_HOME).split(QUICK_ACTION_CARD)` | PASS - recounted in the source: the card `className` occurs at `app/(app)/(manager)/(home)/index.tsx:294,309,330,345,362` |
| C11 | the fifth card's label is `INVITE_QUICK_ACTION_LABEL` and its handler the picker opener, not its own `Share.share` | `-t "the fifth quick action opens the shared picker"` exit 0 | `apps/mobile/lib/invite-share.test.ts:424-425` - `expect(occurrences(quickActions, "invite.openPicker")).toBe(1)` · `expect(occurrences(quickActions, "INVITE_QUICK_ACTION_LABEL")).toBe(1)` over the `Ações rápidas`-to-`Aulas de hoje` slice; `:432` - `expect(quickActions.slice(handlerAt, labelAt)).not.toContain("</Pressable>")`; `:436` - `expect(home).not.toContain("Share.share")` | PASS - round-1 gap 5 closed: the handler is now attributed to the card and to the region |
| C12 | `shouldShowInviteWelcome(undefined)` is `false` | `-t "no member count means no card"` exit 0 | `apps/mobile/lib/invite-share.test.ts:259` - `expect(shouldShowInviteWelcome(undefined)).toBe(false)` | PASS |
| C13 | true at `1`/`4`, false at `5`/`30`, threshold `=== 5` | `-t "the card lives below five active members"` exit 0 | `apps/mobile/lib/invite-share.test.ts:263` - `expect(INVITE_WELCOME_MEMBER_THRESHOLD).toBe(5)`; `:268-269` - `expect(shouldShowInviteWelcome(4)).toBe(true)` · `expect(shouldShowInviteWelcome(5)).toBe(false)` | PASS |
| C14 | card renders before `Ações rápidas`, gated on the predicate; the card wires both presses | `-t "the welcome card sits above the quick actions and offers both actions"` exit 0 | `apps/mobile/lib/invite-share.test.ts:449` - `expect(cardAt).toBeLessThan(headingAt)`; `:453` - `expect(home).toContain("shouldShowInviteWelcome(stats?.activeMembers)")`; `:456-459` - `expect(card).toContain("onInvitePress")` · `toContain("onShareAppPress")` · `toContain("INVITE_LABEL")` · `toContain("SHARE_APP_LABEL")` | PASS (the four `toContain`s prove both props and both labels are named in `InviteWelcomeCard.tsx`, not which `Pressable` each is attached to) |
| C15 | invite message carries the name, the url, an accent, group wording | `-t "the invite message names the academy and speaks to a group"` exit 0 | `apps/mobile/lib/invite-share.test.ts:175-181` - `expect(message).toContain("Academia Alpha")` · `toContain(url)` · `toMatch(ACCENTED)` · `toContain("para todos")` · `expect(message.toLowerCase()).toContain("compartilh")` | PASS |
| C16 | `""`/`null`/`undefined` give the no-academy phrasing, keep the url, no artefacts | `-t "an unnamed academy loses the name, not the sentence"` exit 0 | `apps/mobile/lib/invite-share.test.ts:191-198` - over `["", "   ", null, undefined]`: `toContain(url)` · `toContain("nossa academia")` · `not.toContain("undefined")` · `not.toContain("  ")` · `not.toContain(" .")` | PASS |
| C17 | no entry point holds its own copy of either message; each sharer goes through the module | `-t "no screen keeps its own copy of a message"` exit 0 | `apps/mobile/lib/invite-share.test.ts:474-477` - over the four files: `not.toContain(inviteFragment)` · `not.toContain(appFragment)` · `not.toContain("apptatame.com.br")`; `:482` - `expect(read(file), file).toContain("useInviteShare")` | PASS - precision note carried from round 1: the claim says "imports from `@/lib/invite-share`", the assertion matches `useInviteShare`, which lives in `@/lib/hooks/use-invite-share` |
| C18 | `ROLE_TO_PAPEL` has exactly the three `InviteRole` keys and round-trips | `-t "every role round-trips through its papel token"` exit 0 | `apps/mobile/lib/invite-share.test.ts:138` - `expect(Object.keys(ROLE_TO_PAPEL).sort()).toEqual([...ROLES].sort())`; `:141` - `expect(resolvePapelToRole(ROLE_TO_PAPEL[role]), role).toBe(role)` for all three | PASS |
| C19 | every new label constant is ≤16 chars per line | `-t "every new button label fits a mobile button"` exit 0 | `apps/mobile/lib/invite-share.test.ts:281` - `expect(line.length, line).toBeLessThanOrEqual(16)` over the three constants split on `\n` | PASS |
| C20 | the hook is the only importer of `Share` under `app`/`components`/`lib` | `-t "one hook is the only importer of Share"` exit 0 | `apps/mobile/lib/invite-share.test.ts:499` - `expect(importers).toEqual(["lib/hooks/use-invite-share.ts"])` over every `.ts(x)` file whose `import { … } from "react-native"` names `Share` | PASS (the regex sees only the named-import form) |
| C21 | `lib/invite-share.ts` imports nothing from `react-native` | `-t "the share module stays pure"` exit 0 | `apps/mobile/lib/invite-share.test.ts:292` - `expect(read("lib/invite-share.ts")).not.toContain("react-native")` | PASS - residual nit: the check's heading still annotates it "(door 2)" although the `Coverage` join correctly moved door 2 to C9 + C23 and gave C21 its own `pure-module constraint` row |
| C22 | `description` is optional and `DependentSelectionModal` passes none | `-t "the check-in sheet passes no description"` exit 0 | `apps/mobile/lib/invite-share.test.ts:508-511` - `expect(card).toContain("description?: string;")` · `toContain("Icon = User")` · `expect(read(DEPENDENT_SHEET)).not.toContain("description")` | PASS |
| C23 | the hook wires `APP_SHARE_MESSAGE` to share-app and `inviteShareMessage` to invite, not the other way round, and hands `shareMessage` only a `message` | `-t "each action is wired to its own message"` exit 0 | `apps/mobile/lib/invite-share.test.ts:538` - `expect(hook).toMatch(/shareApp[\s\S]{0,200}?shareMessage\(\s*APP_SHARE_MESSAGE/)`; `:541` - `expect(hook).toMatch(/shareInvite[\s\S]{0,300}?shareMessage\(\s*inviteShareMessage\(/)`; `:545-546` - `expect(occurrences(hook, "APP_SHARE_MESSAGE")).toBe(2)` · `expect(occurrences(hook, "inviteShareMessage")).toBe(2)` | PASS as written - the two *definitions* are pinned. Its claim says nothing about which of them each entry point reaches, and fault G5 shows that gap is live |
| C24 | `SelectionCard` renders the `Icon` it is handed, and `description` outranks the belt line | `-t "the card renders the icon it is handed, and a description outranks the belt line"` exit 0 | `apps/mobile/lib/invite-share.test.ts:519-520` - `expect(card).toMatch(/<Icon size=\{20\}/)` · `expect(card).not.toMatch(/<User size=/)`; `:525` - `expect(card).toMatch(/\{description \? \([\s\S]{0,300}\) : beltSub \? \(/)` | PASS - round-1 gaps 6 and 7 closed |
| C25 | the picker maps all three roles to three distinct glyphs and hands each to `SelectionCard` | `-t "each role gets its own glyph"` exit 0 | `apps/mobile/lib/invite-share.test.ts:567` - `expect(new Set(glyphs).size).toBe(3)` where `glyphs` is parsed per role out of the `ROLE_ICONS` table; `:569` - each glyph matched against `import { … } from "lucide-react-native"`; `:575` - `expect(sheet).toContain("Icon={ROLE_ICONS[option.role]}")` | PASS - round-1 gap 7 closed |
| C26 | `MembersListContent` renders `InviteHeaderActions` and `InviteRoleSheet` in the **true** branch of their gates, and there are exactly two gate sites | `-t "the actions sit in the true branch of the gate"` exit 0 | `apps/mobile/lib/invite-share.test.ts:370` - `expect(members).toMatch(/\{showInviteActions \? \(\s*<InviteHeaderActions/)`; `:373` - same for `<InviteRoleSheet`; `:374` - `expect(members).not.toContain("!showInviteActions")`; `:377` - `expect(occurrences(members, "showInviteActions ?")).toBe(2)` | PASS - round-1 gap 1 closed; two independent mutations of this gate were killed (G1, G6) |

## Coverage

Each row says whether it was recomputed at `0b6e91e` or carried. Members are taken from the
authority over the set, not from `checks.md`'s own table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `InviteRole` -> `papel` token (3) - *carried from eff3752* | `packages/types/src/index.ts:13,28-48` | `student` C18, C2 · `instructor` C18, C2 · `guardian` C18, C2 | - |
| role picker rows (3) - *recomputed at 0b6e91e* | plan AC 1 + `apps/mobile/lib/invite-copy.ts:16-20` | `Aluno` C1 · `Instrutor` C1 · `Responsável` C1, C3 | - (the sourcing clause round 1 left open is now asserted at `invite-share.test.ts:66-70`) |
| entry points (3) - *recomputed at 0b6e91e* | plan `Flow` 1 and AC 1, 9, 14 | members header C4, C26 · home quick action C10, C11 · welcome card C14 | the members-header member's **handler bindings**: nothing asserts which of `invite.openPicker` / `invite.shareApp` each button gets (`MembersListContent.tsx:125-126`) - fault G7 survived |
| share actions (2) - *recomputed at 0b6e91e* | plan AC 2, AC 5 | invite C2, C15, C23 · share-app C5, C23 | the invite action's **delivery**: C23 pins the hook's two definitions, nothing pins what `selectRole` calls (`lib/hooks/use-invite-share.ts:60-64`) - fault G5 survived |
| `MembersListContent` consumers (3) - *carried from eff3752* | `grep -rl` over `apps/mobile/app` - exactly the manager, instructor and student `(members)/index.tsx` | manager C4 · instructor C4 · student C4 | - |
| share-sheet outcomes (3) - *carried from eff3752* | the `react-native` `Share.share` contract | `sharedAction` C9 · `dismissedAction` C6 · rejection C7 | - |
| welcome-card threshold edges (4) - *carried from eff3752* | plan AC 11, 12, 13 | no data C12 · `1` C13 · `4` C13 · `5` C13 | - |
| new button labels (3) - *carried from eff3752* | `apps/mobile/lib/invite-share.ts:106,107,109` | `Convidar` C19 · `Compartilhar app` C19 · `Convidar\nmembro` C19 | - |
| message definitions (2) - *carried from eff3752* | `apps/mobile/lib/invite-share.ts:81,91` | invite C15, C16, C17 · app C5, C17 | - |
| academy-name states in the invite message (4) - *carried from eff3752* | `apps/mobile/lib/academy-context.tsx:19` + plan AC 17 | named C15 · `""` C16 · `null` C16 · `undefined` C16 | - |
| one-way doors (3) - *recomputed at 0b6e91e* | plan `Landing` | door 1 C18 · door 2 C9, C23 · door 3 C20 | - round-1 gap 3 closed: the row no longer credits C21, and door 2's literal shape is settled by the exact-object assertion at `invite-share.test.ts:217` plus C23 |
| pure-module constraint (1) - *recomputed at 0b6e91e* | `apps/mobile/vitest.config.ts:7-13` (`environment: "node"`) | `lib/invite-share.ts` C21 | - |
| role glyphs in the picker (3) - *recomputed at 0b6e91e* | plan `Impact` ("three different glyphs") + `components/InviteRoleSheet.tsx:18-22` | `student` C25 · `instructor` C25 · `guardian` C25 | - round-1 gap 7 closed |
| `SelectionCard`'s new props (2) - *recomputed at 0b6e91e* | `components/SelectionCard.tsx:8,10,23,75,84-88` | `description` C22, C24 · `Icon` C24, C25 | - round-1 gap 6 closed |
| `showInviteActions` gate sites (2) - *recomputed at 0b6e91e* | `components/MembersListContent.tsx:123,196` | header actions C26 · picker mount C26 | - round-1 gap 1 closed |
| `Ações rápidas` cards (5) - *no row in `checks.md`; carried from eff3752* | `app/(app)/(manager)/(home)/index.tsx:294,309,330,345,362` | count C10 · the new card C11 | - |
| `InviteHeaderActions` prop bindings (2) - *no row in `checks.md`; set created by the fix* | `components/InviteHeaderActions.tsx:12-16` (the two `() => void` props) + the call site at `MembersListContent.tsx:124-127` | `onInvitePress` none · `onShareAppPress` none | both - no assertion reads either prop at its call site; swapping them (fault G7) passes 33/33 |
| `useInviteShare` call sites (3) - *no row in `checks.md`; surface the fix touched* | `lib/hooks/use-invite-share.ts:44,50,60` | `shareApp` C23 · `shareInvite` C23 · `selectRole` none | `selectRole` - nothing asserts it calls `shareInvite(role)`; pointing it at `shareApp()` (fault G5) passes 33/33 |

No set claims a status code, a route or a response shape: plan `Surface` is
`None - nothing consumed outside`, the feature issues no request and adds no route. No
startup-configuration set — nothing here runs before the first request.

## Test policy rows — *re-judged at 0b6e91e*

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, and the decision is reachable from more than one screen | `lib/invite-share.ts` | own layer, in a module importing no `react-native` (C21), one case per decision-table row plus every boundary edge | yes - carried from eff3752; the fix did not touch this file. 3 roles C1/C2, boundary `4`/`5` both sides plus `1`/`30`/`undefined` C12/C13, 3 falsy names plus `"   "` C16, three terminal outcomes C6/C7/C9 |
| Decides, reached from one screen only | no file - the `Evidence` list classifies none in this class | - | n/a |
| Instrumentation that wires a decision module to a screen | `app/(app)/(manager)/(home)/index.tsx`, `lib/hooks/use-invite-share.ts` | one source-text assertion that the wiring exists and that no second copy of the decision does | yes - round 1's unmet row is met on its own terms: C23 now asserts the hook's imports and both uses (`invite-share.test.ts:538-546`), and C20 the absence of a duplicate. Recorded with the row: the row's bar stops at "the wiring exists", and fault G5 shows a hook whose definitions are right and whose call site is wrong still passes |
| Pure presentation - maps a prop onto a view with no conditional | `components/InviteRoleSheet.tsx`, `components/InviteWelcomeCard.tsx`, `components/InviteHeaderActions.tsx`, `components/SelectionCard.tsx` | none of its own; covered by the source-text assertion on its consumer | yes - `SelectionCard`'s new conditional is classified and pinned (C24) instead of exempted, which closes round-1 gap 6; `InviteHeaderActions` is classified and its consumer carries C26 |
| *unclassified* | `components/MembersListContent.tsx` | - | no - the `Evidence` list still omits it, and the fix added classifications for two other files while leaving out the one that holds the gate (a conditional reached from three screens) and both prop bindings. Under the instrumentation row it would owe "one source-text assertion that the wiring exists"; C4 and C26 assert the gate, nothing asserts the bindings (fault G7) |

## Faults injected

Isolation: a fresh `git worktree add <scratch> HEAD` (`0b6e91e`) with `node_modules` wired in by
symlink and `packages/types` rebuilt inside the scratch. Never `git stash`. Baseline
`git status --porcelain` of the real tree was empty before and after; the five mutated files were
diffed byte-for-byte against the real tree and the scratch removed. Control run in the scratch
before mutating: 33 passed. All mutations are my own design, none reused from the author's
self-reported four.

| Mutation | Location | Killed |
| --- | --- | --- |
| G1 - the header gate's two **arms swapped** (condition untouched, so `!showInviteActions` never appears): `{showInviteActions ? (<View className="h-10 w-10" />) : (<InviteHeaderActions …/>)}` | `apps/mobile/components/MembersListContent.tsx:123-130` | yes - 1 failed: C26 |
| G2 - `SelectionCard`'s sub-line **arms swapped**: `{beltSub ? (<Text>{description}</Text>) : description ? (…belt dot…)}` | `apps/mobile/components/SelectionCard.tsx:84-88` | yes - 1 failed: C24 |
| G3 - the invite quick-action card **moved out of the `Ações rápidas` region**, re-rendered under the `Aulas de hoje` heading | `apps/mobile/app/(app)/(manager)/(home)/index.tsx:359-376` | yes - 1 failed: C11 (C10's file-wide card count still passed, which is why the region scoping matters) |
| G4 - the picker hands every row a **fixed** glyph: `Icon={ROLE_ICONS[option.role]}` -> `Icon={ROLE_ICONS.student}` | `apps/mobile/components/InviteRoleSheet.tsx:78` | yes - 1 failed: C25 |
| G5 - `selectRole` shares the **wrong message**: `void shareInvite(role)` -> `void shareApp()`, so picking a role in the picker sends the `/baixar` download link and the invite link is never shared at all (AC 2 void) | `apps/mobile/lib/hooks/use-invite-share.ts:63` | no - 33 passed, 0 failed |
| G6 - a **third** `showInviteActions ?` gate site added above the search box *(beyond the five, requested by the coordinator)* | `apps/mobile/components/MembersListContent.tsx:132` | yes - 1 failed: C26's `occurrences(…) === 2` |
| G7 - the two handler props **swapped** at the call site: `onInvitePress={invite.shareApp}` / `onShareAppPress={invite.openPicker}`, so `Convidar` shares the download page and the share icon opens the role picker (AC 1 and AC 5 both void) *(beyond the five, the one surface with no assertion at all)* | `apps/mobile/components/MembersListContent.tsx:125-126` | no - 33 passed, 0 failed |

Five faults within the profile's cap (G1–G5), one per distinct assertion surface the fix created
or strengthened (C26, C24, C11, C25, C23). G6 and G7 are recorded beyond the cap and labelled: G6
because the coordinator named that mutation shape explicitly, G7 because it is the only surface in
the fix's diff that carries no assertion whatsoever.

**Two surviving mutants, one root cause.** Every proof on this feature's wiring reads *definitions*
— which message a named function builds, which element sits in which branch. None reads a *call
site or a prop binding*. G5 and G7 are the two places that distinction is load-bearing, and both
break the feature's primary acceptance criterion while the suite stays green.

## Gate

`pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts --reporter=verbose` - 33
passed, 0 failed (all 26 checks' named tests shown individually).
`pnpm --filter @tatame/mobile test` - 9 files, 104 passed, 0 failed.
`npx tsc --noEmit` in `apps/mobile` - 5 errors, the same five `.specs/STATE.md` records
(`(manager)/(members)/[membershipId].tsx` ×2, `(student)/register-belt.tsx`, `app/_layout.tsx`,
`components/DependentSelectionModal.tsx`); none in a file this feature wrote, including the new
`components/InviteHeaderActions.tsx`.

## Ranked gaps

1. **`selectRole` can share the wrong message and nothing fails — surviving mutant G5.**
   `apps/mobile/lib/hooks/use-invite-share.ts:63` — C23 asserts the two `shareMessage` call
   *definitions* (`invite-share.test.ts:538,541`) and their occurrence counts, so replacing
   `void shareInvite(role)` with `void shareApp()` leaves every regex satisfied. The entire invite
   flow would share `https://apptatame.com.br/baixar` instead of the `?papel=` link — AC 2 void —
   with 33/33 green. A proof that pins `selectRole`'s body (e.g. a regex anchored on
   `selectRole[\s\S]{0,120}?shareInvite(role)`) closes it.
2. **The two header handler props can be swapped and nothing fails — surviving mutant G7.**
   `apps/mobile/components/MembersListContent.tsx:125-126` — no assertion reads either prop at the
   call site. Swapping them makes `Convidar` share the download page and the share icon open the
   role picker, voiding AC 1 and AC 5. The extraction into `InviteHeaderActions` is what made this
   a single, pinnable line — the fix created the hook for the proof and did not write it.
   `InviteWelcomeCard`'s two props (`:456-457`, asserted only inside the component) and
   `InviteRoleSheet`'s `onSelect` at `MembersListContent.tsx:197-200` sit on the same unasserted
   surface.
3. **`components/MembersListContent.tsx` is still unclassified by the `Test policy` evidence.** It
   holds the `showInviteActions` conditional (reached from three screens) and both prop bindings,
   and the fix added rows for `InviteHeaderActions.tsx` and `SelectionCard.tsx` while leaving this
   one out. Classifying it as instrumentation is what would make gap 2 an owed proof rather than an
   oversight.
4. **`checks.md`'s `## Handoff` is stale.** It still claims "C1-C22 closed. All 22 proofs green …
   (29 tests); the mobile suite went 71 -> 100 tests". At `0b6e91e` it is 26 checks, 33 tests and
   104. Prose only — no proof depends on it.
5. **C21's heading still annotates it "(door 2)".** The `Coverage` join was correctly re-pointed to
   C9 + C23 and C21 given its own `pure-module constraint` row, so this is a leftover label, not a
   mis-join.
6. **Carried precision note.** C17's claim says each sharer "imports from `@/lib/invite-share`";
   the assertion at `invite-share.test.ts:482` matches `useInviteShare`, which lives in
   `@/lib/hooks/use-invite-share`.

Open question 1 in `plan.md` (a store build exercised on a real iOS and Android device) remains
open and blocks go-live, not the checks.
