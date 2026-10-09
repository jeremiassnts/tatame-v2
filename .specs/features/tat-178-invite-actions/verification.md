# TAT-178 — Manager share and invite actions · verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: `79592ec..4feb67e`
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scoped by the fix's diff (`0b6e91e..4feb67e`) plus every round-2 verdict that was not PASS.
Everything else is marked `carried from 0b6e91e`. Proofs re-ran in full at the new `HEAD`.

`4feb67e` changes **no implementation file** — only `lib/invite-share.test.ts`, `checks.md` and the
previous report — so every source citation below is unchanged from round 2 and only the test-file
line numbers moved.

**Round-2 gaps, re-judged.** Gap 1 (`selectRole`) and gap 2 (the header prop swap) are closed for
the exact mutations that produced them: I re-injected both and both now fail (R1, R2 below). Gaps
3, 4, 5 and 6 are closed. But the root cause I named in round 2 was *"every proof reads a
definition, none reads a call site or a prop binding"*, and the fix closed that family at the four
mount sites and the three callback bodies while leaving **two more members of the same family
untouched**, both of which I made survive. The two new helpers that do the locating are themselves
defeatable, which is the second finding.

**The fix's own claims, checked rather than accepted:**

- "No claim above S6 was touched." True with one intended exception. `git diff 0b6e91e..HEAD --
  …/checks.md | grep '^-'` removes six lines: the header count, C21's `(door 2)` annotation (round-2
  gap 5, replaced by "pure-module constraint; door 2 itself is proven by C9 and C23"), one reworded
  line of the `InviteHeaderActions` `Test policy` bullet, the `Cost` line and two `Handoff` lines.
  No C1–C26 claim body changed.
- "No assertion weakened." True: the commit removes exactly **one** line from
  `lib/invite-share.test.ts` — the `for (const file of [...])` header of C17's loop, replaced by the
  same list plus `HEADER_ACTIONS` and a new `toMatch` inside the body. No assertion deleted, 38
  `it(` blocks, 38 ran, no `.skip`/`.only`/`.todo`.
- Suite 104 → 109, `invite-share.test.ts` 29 → 33 → **38**. Confirmed.
- `## Handoff` is now accurate (28 proofs, 38 tests, 71 → 109) — round-2 gap 4 closed.

**Binding sources** — *carried from eff3752*. No design was binding (`plan.md`'s `## Sources` names
no `design.pen` screen and no artifact URL), so step 1's section is not owed at this profile. The
two binding **code** locations (`packages/types/src/index.ts:17-48`,
`apps/web/app/baixar/page.tsx:7-18`) were opened in round 1; neither is in this fix's diff. No
contradiction, nothing uncovered.

## Checks — *verified at 4feb67e*

All 28 proofs re-run at `HEAD` in one batched invocation with `--reporter=verbose`: every test name
printed individually, **38 passed, 0 failed**. Each of the 28 `-t` names in `checks.md` was matched
to a test that exists and ran. Citations below line 305 of the test file are unchanged from round 2;
everything after it is refreshed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | three options in order, labelled *from* `ROLE_LABELS` | `-t "lists the three roles in order"` exit 0 | `apps/mobile/lib/invite-share.test.ts:51` - `expect(INVITE_ROLE_OPTIONS.map((o) => o.role)).toEqual(["student","instructor","guardian"])`; `:66` - `expect(module).toContain("ROLE_LABELS.student")`; `:70` - `expect(module, label).not.toContain(label)` over `Object.values(ROLE_LABELS)` | PASS |
| C2 | url per role, and it parses back | `-t "builds the invite url for each role"` · `-t "every url it builds is one parseInviteLink accepts"` exit 0 | `apps/mobile/lib/invite-share.test.ts:104` - `expect(buildInviteUrl("acad-1","guardian")).toBe("https://apptatame.com.br/convite/acad-1?papel=responsavel")`; `:121` - `expect(parseInviteLink(url), role).toEqual({ academyId: "acad-42", role })` over all three roles | PASS |
| C3 | guardian description names the adult, cadastrar, dependente | `-t "the guardian option explains it invites the adult"` exit 0 | `apps/mobile/lib/invite-share.test.ts:83-85` - `toContain("responsável")` · `toContain("cadastra")` · `toContain("dependente")` | PASS |
| C4 | header actions only under `showInviteActions`, default `false`; only the manager list passes it | `-t "only the manager members list asks for the invite actions"` exit 0 | `apps/mobile/lib/invite-share.test.ts:391` - `expect(read(MEMBERS_LIST)).toContain("showInviteActions = false")`; `:395-396` - `expect(read(INSTRUCTOR_MEMBERS)).not.toContain("showInviteActions")` and the same for the student list | PASS |
| C5 | `APP_DOWNLOAD_URL` is `/baixar`; app message carries it, no `/convite/`, not the apex | `-t "the app message points at the download page"` exit 0 | `apps/mobile/lib/invite-share.test.ts:158` - `expect(APP_DOWNLOAD_URL).toBe("https://apptatame.com.br/baixar")`; `:164` - `not.toContain("/convite/")`; `:163` - `expect(APP_SHARE_MESSAGE.endsWith("https://apptatame.com.br")).toBe(false)` | PASS |
| C6 | `dismissedAction` reports zero times, no throw | `-t "a dismissed sheet reports nothing"` exit 0 | `apps/mobile/lib/invite-share.test.ts:227` - `.resolves.toBeUndefined()`; `:229` - `expect(reportError).not.toHaveBeenCalled()` (stub resolves `{ action: "dismissedAction" }`) | PASS |
| C7 | a rejection reports exactly once, title `Erro`, accented body | `-t "a failed share raises one Portuguese alert"` exit 0 | `apps/mobile/lib/invite-share.test.ts:240` - `expect(reportError).toHaveBeenCalledTimes(1)`; `:242` - `expect(title).toBe("Erro")`; `:243` - `expect(body).toMatch(ACCENTED)` | PASS |
| C8 | the picker is a `Modal` over `SelectionCard` with `visible`/`onClose`/`onSelect`, no `ModalSelect` | `-t "the picker follows the DependentSelectionModal shape"` exit 0 | `apps/mobile/lib/invite-share.test.ts:425-429` - `toContain("<Modal")` · `toContain("visible")` · `toContain("onClose")` · `toContain("onSelect")` · `toContain("<SelectionCard")`; `:432` - `not.toContain("ModalSelect")` | PASS (substring-level: the prop names are matched as bare words) |
| C9 | `sharedAction` reports zero times | `-t "a completed share reports nothing"` exit 0 | `apps/mobile/lib/invite-share.test.ts:217` - `expect(share).toHaveBeenCalledWith({ message: "hello" })` (exact object - an added `url` key fails here, which is door 2's proof); `:218` - `not.toHaveBeenCalled()` | PASS |
| C10 | `Ações rápidas` holds exactly five cards | `-t "the manager home has five quick actions"` exit 0 | `apps/mobile/lib/invite-share.test.ts:453` - `expect(cards).toBe(5)` | PASS - recounted in the source at `app/(app)/(manager)/(home)/index.tsx:294,309,330,345,362` |
| C11 | the fifth card's label is `INVITE_QUICK_ACTION_LABEL` and its handler the picker opener | `-t "the fifth quick action opens the shared picker"` exit 0 | `apps/mobile/lib/invite-share.test.ts:463-464` - `expect(occurrences(quickActions, "invite.openPicker")).toBe(1)` · same for the label, over the `Ações rápidas`-to-`Aulas de hoje` slice; `:471` - `not.toContain("</Pressable>")` between handler and label; `:475` - `expect(home).not.toContain("Share.share")` | PASS |
| C12 | `shouldShowInviteWelcome(undefined)` is `false` | `-t "no member count means no card"` exit 0 | `apps/mobile/lib/invite-share.test.ts:259` - `expect(shouldShowInviteWelcome(undefined)).toBe(false)` | PASS |
| C13 | true at `1`/`4`, false at `5`/`30`, threshold `=== 5` | `-t "the card lives below five active members"` exit 0 | `apps/mobile/lib/invite-share.test.ts:263` - `expect(INVITE_WELCOME_MEMBER_THRESHOLD).toBe(5)`; `:268-269` - `expect(shouldShowInviteWelcome(4)).toBe(true)` · `expect(shouldShowInviteWelcome(5)).toBe(false)` | PASS |
| C14 | card renders before `Ações rápidas`, gated on the predicate; the card wires both presses | `-t "the welcome card sits above the quick actions and offers both actions"` exit 0 | `apps/mobile/lib/invite-share.test.ts:488` - `expect(cardAt).toBeLessThan(headingAt)`; `:492` - `toContain("shouldShowInviteWelcome(stats?.activeMembers)")`; `:495-498` - `toContain("onInvitePress")` · `"onShareAppPress"` · `"INVITE_LABEL"` · `"SHARE_APP_LABEL"` | PASS - the four `toContain`s prove the names are present in the file; which control carries which **label** is still unasserted (fault I6) |
| C15 | invite message carries the name, the url, an accent, group wording | `-t "the invite message names the academy and speaks to a group"` exit 0 | `apps/mobile/lib/invite-share.test.ts:175-181` - `toContain("Academia Alpha")` · `toContain(url)` · `toMatch(ACCENTED)` · `toContain("para todos")` · `toContain("compartilh")` | PASS |
| C16 | `""`/`null`/`undefined` give the no-academy phrasing, keep the url, no artefacts | `-t "an unnamed academy loses the name, not the sentence"` exit 0 | `apps/mobile/lib/invite-share.test.ts:191-198` - over `["", "   ", null, undefined]`: `toContain(url)` · `toContain("nossa academia")` · `not.toContain("undefined")` · `not.toContain("  ")` · `not.toContain(" .")` | PASS |
| C17 | no entry point holds its own copy of either message, and each reads from the shared module | `-t "no screen keeps its own copy of a message"` exit 0 | `apps/mobile/lib/invite-share.test.ts:519-521` - over the five files incl. the new `InviteHeaderActions.tsx`: `not.toContain(inviteFragment)` · `not.toContain(appFragment)` · `not.toContain("apptatame.com.br")`; `:525` - `expect(source, file).toMatch(/from "@\/lib\/(hooks\/use-)?invite-share"/)` | PASS - round-2 gap 6 closed: the claim's "from there" is now the assertion, not `useInviteShare` by name |
| C18 | `ROLE_TO_PAPEL` has exactly the three `InviteRole` keys and round-trips | `-t "every role round-trips through its papel token"` exit 0 | `apps/mobile/lib/invite-share.test.ts:138` - `expect(Object.keys(ROLE_TO_PAPEL).sort()).toEqual([...ROLES].sort())`; `:141` - `expect(resolvePapelToRole(ROLE_TO_PAPEL[role]), role).toBe(role)` for all three | PASS |
| C19 | every new label constant is ≤16 chars per line | `-t "every new button label fits a mobile button"` exit 0 | `apps/mobile/lib/invite-share.test.ts:281` - `expect(line.length, line).toBeLessThanOrEqual(16)` over the three constants split on `\n` | PASS |
| C20 | the hook is the only importer of `Share` under `app`/`components`/`lib` | `-t "one hook is the only importer of Share"` exit 0 | `apps/mobile/lib/invite-share.test.ts:549` - `expect(importers).toEqual(["lib/hooks/use-invite-share.ts"])` | PASS |
| C21 | `lib/invite-share.ts` imports nothing from `react-native` (pure-module constraint) | `-t "the share module stays pure"` exit 0 | `apps/mobile/lib/invite-share.test.ts:292` - `expect(read("lib/invite-share.ts")).not.toContain("react-native")` | PASS - round-2 gap 5 closed: the misleading `(door 2)` annotation is gone |
| C22 | `description` is optional and `DependentSelectionModal` passes none | `-t "the check-in sheet passes no description"` exit 0 | `apps/mobile/lib/invite-share.test.ts:558-561` - `toContain("description?: string;")` · `toContain("Icon = User")` · `expect(read(DEPENDENT_SHEET)).not.toContain("description")` | PASS |
| C23 | the hook wires `APP_SHARE_MESSAGE` to share-app and `inviteShareMessage` to invite, and hands `shareMessage` only a `message` | `-t "each action is wired to its own message"` exit 0 | `apps/mobile/lib/invite-share.test.ts:588` - `toMatch(/shareApp[\s\S]{0,200}?shareMessage\(\s*APP_SHARE_MESSAGE/)`; `:591` - `toMatch(/shareInvite[\s\S]{0,300}?shareMessage\(\s*inviteShareMessage\(/)`; `:595-596` - `expect(occurrences(hook, "APP_SHARE_MESSAGE")).toBe(2)` · same for `inviteShareMessage` | PASS |
| C24 | `SelectionCard` renders the `Icon` it is handed, and `description` outranks the belt line | `-t "the card renders the icon it is handed…"` exit 0 | `apps/mobile/lib/invite-share.test.ts:569-570` - `toMatch(/<Icon size=\{20\}/)` · `not.toMatch(/<User size=/)`; `:575` - `toMatch(/\{description \? \([\s\S]{0,300}\) : beltSub \? \(/)` | PASS |
| C25 | the picker maps all three roles to three distinct glyphs and hands each to `SelectionCard` | `-t "each role gets its own glyph"` exit 0 | `apps/mobile/lib/invite-share.test.ts:697` - `expect(new Set(glyphs).size).toBe(3)`; `:699` - each glyph matched against the `lucide-react-native` import; `:705` - `toContain("Icon={ROLE_ICONS[option.role]}")` | PASS |
| C26 | `InviteHeaderActions` and `InviteRoleSheet` sit in the **true** branch of their gates, exactly two gate sites | `-t "the actions sit in the true branch of the gate"` exit 0 | `apps/mobile/lib/invite-share.test.ts:409` - `toMatch(/\{showInviteActions \? \(\s*<InviteHeaderActions/)`; `:412` - same for `<InviteRoleSheet`; `:413` - `not.toContain("!showInviteActions")`; `:416` - `expect(occurrences(members, "showInviteActions ?")).toBe(2)` | PASS |
| C27 | every mount hands each action the handler its name promises, and inside the two components each handler sits on the control its glyph identifies | `-t "every mount hands each action the handler its name promises"` · `-t "inside each component the handler sits on the control its glyph names"` exit 0 | `apps/mobile/lib/invite-share.test.ts:614` - `expect(occurrences(source, open), …).toBe(1)` per mount; `:630-631` - `expect(mount, where).toContain("onInvitePress={invite.openPicker}")` · `toContain("onShareAppPress={invite.shareApp}")`; `:626` - `toContain("onSelect={invite.selectRole}")`; `:642-643` - `handlerOwnsControl(source, "onInvitePress", "<UserPlus")` · `(…, "onShareAppPress", "<Share2")`, whose own assertions are `:342` `occurrences(source, \`onPress={${handler}}\`) === 1`, `:345` the marker occurs after the handler, `:349` `not.toContain("</Pressable>")` between them | PASS as written - and it kills both round-2 survivors (R1, R2). Recorded with it: `handlerOwnsControl`'s "no `</Pressable>` between" rule is satisfiable while the pairing is false (fault I2), and it pins handler-to-**glyph**, never handler-to-**label** (fault I6) |
| C28 | `selectRole` shares the invite and never the app message; `shareApp` never reaches for the invite builder; `shareInvite` never reaches for the app message - over each `useCallback` body | `-t "picking a role shares the invite, never the app message"` · `-t "the share-app action never reaches for the invite builder"` · `-t "the invite action never reaches for the app message"` exit 0 | `apps/mobile/lib/invite-share.test.ts:653-657` - `expect(body).toContain("setPickerVisible(false)")` · `toContain("shareInvite(role)")` · `not.toContain("shareApp")`; `:663-665` - `toContain("APP_SHARE_MESSAGE")` · `not.toContain("inviteShareMessage")` · `not.toContain("buildInviteUrl")`; `:675-676` - `toContain("buildInviteUrl(academyId, role)")` · `not.toContain("APP_SHARE_MESSAGE")`; the region comes from `callbackBody` at `:360-366` | PASS as written - and it kills round-2's survivor (R1). Recorded with it: `callbackBody`'s terminator is the substring `"  );"`, which any `);` at indentation ≥2 satisfies, so the region is "up to the first multi-line call that closes in the body" and every `not.toContain` past that point is conditional (fault I3) |

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `InviteRole` -> `papel` token (3) - *carried from 0b6e91e* | `packages/types/src/index.ts:13,28-48` | `student` C18, C2 · `instructor` C18, C2 · `guardian` C18, C2 | - |
| role picker rows (3) - *carried from 0b6e91e* | plan AC 1 + `apps/mobile/lib/invite-copy.ts:16-20` | `Aluno` C1 · `Instrutor` C1 · `Responsável` C1, C3 | - |
| entry points (3) - *recomputed at 4feb67e* | plan `Flow` 1 and AC 1, 9, 14 | members header C4, C26, C27 · home quick action C10, C11 · welcome card C14, C27 | - round-2's open member (the header's handler bindings) is closed by C27 |
| share actions (2) - *recomputed at 4feb67e* | plan AC 2, AC 5 | invite C2, C15, C23, C28 · share-app C5, C23, C28 | - round-2's open member (`selectRole`'s delivery) is closed by C28 for the mutation that found it |
| `MembersListContent` consumers (3) - *carried from 0b6e91e* | `grep -rl` over `apps/mobile/app` - exactly the manager, instructor and student `(members)/index.tsx` | manager C4 · instructor C4 · student C4 | - |
| share-sheet outcomes (3) - *carried from 0b6e91e* | the `react-native` `Share.share` contract | `sharedAction` C9 · `dismissedAction` C6 · rejection C7 | - |
| welcome-card threshold edges (4) - *carried from 0b6e91e* | plan AC 11, 12, 13 | no data C12 · `1` C13 · `4` C13 · `5` C13 | - |
| new button labels (3) - *carried from 0b6e91e* | `apps/mobile/lib/invite-share.ts:106,107,109` | `Convidar` C19 · `Compartilhar app` C19 · `Convidar\nmembro` C19 | - |
| message definitions (2) - *recomputed at 4feb67e* | `apps/mobile/lib/invite-share.ts:81,91` | invite C15, C16, C17 · app C5, C17 | - C17 now asserts the import rather than a name |
| academy-name states in the invite message (4) - *carried from 0b6e91e* | `apps/mobile/lib/academy-context.tsx:19` + plan AC 17 | named C15 · `""` C16 · `null` C16 · `undefined` C16 | - |
| one-way doors (3) - *recomputed at 4feb67e* | plan `Landing` | door 1 C18 · door 2 C9, C23, C28 · door 3 C20 | - |
| pure-module constraint (1) - *carried from 0b6e91e* | `apps/mobile/vitest.config.ts:7-13` | `lib/invite-share.ts` C21 | - |
| role glyphs in the picker (3) - *carried from 0b6e91e* | plan `Impact` + `components/InviteRoleSheet.tsx:18-22` | `student` C25 · `instructor` C25 · `guardian` C25 | - |
| `SelectionCard`'s new props (2) - *carried from 0b6e91e* | `components/SelectionCard.tsx:8,10,23,75,84-88` | `description` C22, C24 · `Icon` C24, C25 | - |
| `showInviteActions` gate sites (2) - *carried from 0b6e91e* | `components/MembersListContent.tsx:123,196` | header actions C26 · picker mount C26 | - |
| prop bindings at mount sites (4) - *recomputed at 4feb67e* | the four `<Invite…` mounts: `MembersListContent.tsx:124,197` and `(manager)/(home)/index.tsx:280,412` | header actions C27 · members picker C27 · welcome card C27 · home picker C27 | - all four recounted in the source; `occurrences === 1` per element per file holds |
| handler-to-control bindings inside the new components (4) - *recomputed at 4feb67e* | `components/InviteHeaderActions.tsx:24,30` and `components/InviteWelcomeCard.tsx:36,46` | invite -> `UserPlus` header C27 · share-app -> `Share2` header C27 · invite -> `UserPlus` card C27 · share-app -> `Share2` card C27 | the **pairing itself**, as opposed to handler-then-marker order: `handlerOwnsControl` passes on a nested-`Pressable` layout in which the glyph belongs to the other handler (fault I2) |
| share call sites in the hook (3) - *recomputed at 4feb67e* | `lib/hooks/use-invite-share.ts:44,50,60` | `selectRole` -> `shareInvite` C28 · `shareApp` -> `APP_SHARE_MESSAGE` C28 · `shareInvite` -> `inviteShareMessage` C28 | the `selectRole` member's exclusion clause: `not.toContain("shareApp")` only covers the part of the body before the first multi-line call (fault I3) |
| **picker row -> role argument (3)** - *no row in `checks.md`; set swept in at 4feb67e* | plan AC 2 (`<token>` is `aluno` for `Aluno`, `instrutor` for `Instrutor`, `responsavel` for `Responsável`) against `components/InviteRoleSheet.tsx:77` - `onPress={() => onSelect(option.role)}` | `student` none · `instructor` none · `guardian` none | all three - no assertion reads the argument the row hands up. Hardcoding it (fault I1) makes every row invite a student and passes 38/38 |
| **handler-to-label bindings in the welcome card (2)** - *no row in `checks.md`; set swept in at 4feb67e* | `components/InviteWelcomeCard.tsx:36,42,46,52` | `INVITE_LABEL` -> invite press: none · `SHARE_APP_LABEL` -> share-app press: none | both - C14 proves both constants appear in the file and C27 pins handler-to-glyph; swapping the two labels (fault I6) passes 38/38 |

No set claims a status code, a route or a response shape (plan `Surface`:
`None - nothing consumed outside`). No startup-configuration set.

## Test policy rows — *re-judged at 4feb67e*

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, and the decision is reachable from more than one screen | `lib/invite-share.ts`; **newly** `components/MembersListContent.tsx` | own layer in a module importing no `react-native`; one case per decision-table row plus every boundary edge | yes - `lib/invite-share.ts` carried from 0b6e91e. `MembersListContent.tsx` is round-2 gap 3 closed: classified rather than omitted, and enumerated (C26 polarity and branch, C27 bindings, C4 the three consumers) rather than exempted. Two notes: the row's literal "module importing no `react-native`" is unsatisfiable for a component, so the classification and the required-proof column disagree; and only the gate's true branch is pinned - the false arm's 40×40 spacer is unasserted, which no criterion covers |
| Decides, reached from one screen only | no file - the `Evidence` list classifies none in this class | - | n/a |
| Instrumentation that wires a decision module to a screen | `app/(app)/(manager)/(home)/index.tsx`, `lib/hooks/use-invite-share.ts` | one source-text assertion that the wiring exists and that no second copy of the decision does | yes - C28 now asserts over each `useCallback` body (`invite-share.test.ts:653-676`), which is the level round 2's survivor lived at, and C20 the absence of a duplicate. Recorded: the region those three tests assert over is produced by `callbackBody`, whose terminator truncates at the first multi-line call (fault I3) |
| Pure presentation - maps a prop onto a view with no conditional | `components/InviteRoleSheet.tsx`, `components/InviteWelcomeCard.tsx`, `components/InviteHeaderActions.tsx`, `components/SelectionCard.tsx` | none of its own; covered by the source-text assertion on its consumer | no - met for `InviteWelcomeCard`, `InviteHeaderActions` and `SelectionCard`, **not met for `components/InviteRoleSheet.tsx`**: the row's coverage expectation is "covered by the source-text assertion on its consumer", and the consumer's assertion (C27's mount check) covers `onSelect={invite.selectRole}` - what the screen hands *down*. Nothing covers what the sheet hands *up*, which is the role argument at `InviteRoleSheet.tsx:77` and the one thing AC 2 turns on. Fault I1 is this row stated as a mutant |

## Faults injected

Isolation: a fresh `git worktree add <scratch> HEAD` (`4feb67e`) with `node_modules` wired in by
symlink and `packages/types` rebuilt inside the scratch. Never `git stash`. Baseline
`git status --porcelain` of the real tree empty before and after; the six mutated files diffed
byte-for-byte against the real tree and the scratch removed. Control run in the scratch before
mutating: 38 passed. Every mutation is my own design — none reused from the author's self-reported
four or from my own earlier seven.

| Mutation | Location | Killed |
| --- | --- | --- |
| I1 - every picker row invites a student whatever was tapped: `onPress={() => onSelect(option.role)}` -> `onPress={() => onSelect("student")}`. `Instrutor` and `Responsável` both share `?papel=aluno`; AC 2 void for two of three roles | `apps/mobile/components/InviteRoleSheet.tsx:77` | no - 38 passed, 0 failed |
| I2 - nested `Pressable`: the outer one carries `onInvitePress` and its entire visible content is an inner `Pressable` carrying `onShareAppPress`, so every tap on the `UserPlus` "Convidar" control shares the download page. `handlerOwnsControl` still sees handler -> marker with no `</Pressable>` between, for both pairs | `apps/mobile/components/InviteHeaderActions.tsx:22-39` | no - 38 passed, 0 failed |
| I3 - `selectRole` also fires the app share, placed after an innocuous multi-line call so `callbackBody`'s `"  );"` terminator ends the region first; picking a role opens two share sheets, the second carrying `/baixar` | `apps/mobile/lib/hooks/use-invite-share.ts:60-66` | no - 38 passed, 0 failed |
| I4 - `selectRole` renamed to `pickRole`, hook export and both mounts updated to match | `apps/mobile/lib/hooks/use-invite-share.ts:60`, `components/MembersListContent.tsx:199`, `(manager)/(home)/index.tsx:415` | yes - 2 failed: C27's mount check and C28's `selectRole` body. `callbackBody` fails loudly on a rename rather than returning an empty region |
| I5 - a second `<InviteRoleSheet>` mount in the same file, wired `onSelect={invite.shareApp}` | `apps/mobile/components/MembersListContent.tsx:196-202` | yes - 2 failed: C26's gate-site count and C27's `occurrences(source, open) === 1` |
| I6 - the two button labels swapped in the welcome card: the primary purple button reads `Compartilhar app` and opens the role picker, the outline button reads `Convidar` and shares the download page *(beyond the five, on the `InviteWelcomeCard` surface the coordinator asked me to judge)* | `apps/mobile/components/InviteWelcomeCard.tsx:42,52` | no - 38 passed, 0 failed |
| R1 - *round-2 regression check, not a new fault*: re-injection of round 2's survivor G5, `void shareInvite(role)` -> `void shareApp()` | `apps/mobile/lib/hooks/use-invite-share.ts:63` | yes - 1 failed: C28's `selectRole` body |
| R2 - *round-2 regression check, not a new fault*: re-injection of round 2's survivor G7, the two header handler props swapped | `apps/mobile/components/MembersListContent.tsx:125-126` | yes - 1 failed: C27's mount check |

I1–I5 are the five within the profile's cap, one per distinct assertion surface the fix created
(C27's mount check, `handlerOwnsControl`, `callbackBody`, C26/C27's duplicate-mount guard) plus the
one surface in the same family the fix did not reach. I6 is recorded beyond the cap. R1 and R2 are
regression checks on the two round-2 verdicts that were not PASS, not new experiments.

**Four surviving mutants, and they are not one finding.** I1 and I6 are *uncovered surfaces*: the
role argument a picker row hands up, and which label sits on which control. Both are ordinary
copy-and-paste mistakes between two near-identical JSX blocks — the same shape as the swap C27 was
written to catch, one prop over — and I1 breaks the feature's primary criterion for two of its three
roles. I2 and I3 are *defeatable locators*: the two new helpers decide which region the assertions
read, and each can be made to read a region in which the mutation is not present. I2's specific JSX
(a nested `Pressable`) is an unlikely accident and I say so; the weakness it demonstrates is not,
because `handlerOwnsControl`'s rule is "the marker occurs after the handler with no closing tag
between", which is weaker than "they are the same element". I3's filler line is likewise contrived,
but any future multi-line call inside one of those three callbacks silently voids every
`not.toContain` after it, and nothing in the suite would say so.

## Gate

`pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts --reporter=verbose` - 38
passed, 0 failed (all 28 checks' named tests shown individually).
`pnpm --filter @tatame/mobile test` - 9 files, 109 passed, 0 failed.
`npx tsc --noEmit` in `apps/mobile` - 5 errors, the same five `.specs/STATE.md` records
(`(manager)/(members)/[membershipId].tsx` ×2, `(student)/register-belt.tsx`, `app/_layout.tsx`,
`components/DependentSelectionModal.tsx`); none in a file this feature wrote.

## Ranked gaps

1. **Every picker row can invite the same role and nothing fails — surviving mutant I1.**
   `apps/mobile/components/InviteRoleSheet.tsx:77` — `onPress={() => onSelect(option.role)}` →
   `onSelect("student")`: tapping `Instrutor` or `Responsável` shares `?papel=aluno`. AC 2 is void
   for two of three roles and 38/38 pass. This is the third member of the family the fix was
   designed around, and the only one still open: C27 pins what the *screen hands down* to the sheet,
   nothing pins what the *sheet hands up*. One assertion closes it — `expect(sheet).toContain("onPress={() => onSelect(option.role)}")`,
   or a `handlerOwnsControl`-style pairing of the row's `key={option.role}` with its handler.
   It is also the `Test policy` row-4 verdict above, stated as a mutant.
2. **The two welcome-card labels can be swapped and nothing fails — surviving mutant I6.**
   `apps/mobile/components/InviteWelcomeCard.tsx:42,52` — the primary button then reads
   `Compartilhar app` and opens the role picker; the outline button reads `Convidar` and shares the
   download page. C14 proves both constants are in the file; C27's `handlerOwnsControl` pairs each
   handler with its **glyph** and never with its **label**. Extending `handlerOwnsControl` to take a
   second marker, or calling it once per label, closes it.
3. **`handlerOwnsControl` tests order, not containment — surviving mutant I2.**
   `apps/mobile/lib/invite-share.test.ts:339-350` — "the marker occurs after the handler with no
   `</Pressable>` between them" is satisfied by a nested `Pressable` whose glyph belongs to the
   inner handler (`InviteHeaderActions.tsx:22-39` restructured). The specific JSX is an unlikely
   accident; the helper's rule is weaker than the claim it carries, and C27's second test is the only
   proof of four `Coverage` members.
4. **`callbackBody` truncates at the first multi-line call — surviving mutant I3.**
   `apps/mobile/lib/invite-share.test.ts:363` — `const to = source.indexOf("  );", from)` matches any
   `);` at indentation ≥2, so the "body" is only the text up to the first multi-line call that closes
   inside it. All three of C28's `not.toContain` exclusions (`shareApp`, `inviteShareMessage`,
   `buildInviteUrl`, `APP_SHARE_MESSAGE`) are conditional on that. A brace-matched end, or anchoring
   on the dependency array, closes it.
5. **A classification mismatch in the `Test policy` evidence.** `components/MembersListContent.tsx`
   is now classified "decides, reachable from more than one screen", whose required-proof column
   reads "one at its own layer, in a module that imports no `react-native`" — which a component
   cannot be. The substitution is enumerated rather than blanket, which is the right shape; the row
   it was filed under is the wrong one.
6. **Carried precision notes.** C8's `visible` / `onClose` / `onSelect` are matched as bare
   substrings (`invite-share.test.ts:425-429`); C20's importer scan sees only the named-import form
   (`:549`); the gate's false arm (the 40×40 spacer at `MembersListContent.tsx:130`) is unasserted,
   which no criterion covers.

Open question 1 in `plan.md` (a store build exercised on a real iOS and Android device) remains open
and blocks go-live, not the checks.

**Round 3 of 3 — the bound is exhausted.** Per `verify.md` this escalates to the user rather than to
a fourth fix round. Gaps 1 and 2 are single-assertion fixes on files already in the diff; gaps 3 and
4 are fixes to two test helpers, not to the feature. Nothing found in three rounds touches the pure
decision module, the `papel` table, the threshold, the messages or the share outcomes — all of those
have been green and mutation-tested since round 1.
