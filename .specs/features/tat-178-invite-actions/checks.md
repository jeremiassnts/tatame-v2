# TAT-178 — Manager share and invite actions · checks

Profile: standard
Plan: `.specs/features/tat-178-invite-actions/plan.md`

28 checks in 6 slices · 3 one-way doors · 1 open, of which 0 block (1 blocks go-live)

Every proof below runs from the repository root and assumes `pnpm --filter @tatame/types build`
has run once, the way CI's `pnpm build` step does before `pnpm test:unit`. Baseline before this
feature: 8 files, 71 tests, green.

## Checks

### S1 - The picker and the Members screen entry point · 7 files · 20 KB · ~5k

**C1** - `INVITE_ROLE_OPTIONS` holds exactly three options, in the order `student`, `instructor`,
`guardian`, each labelled from `ROLE_LABELS` (`Aluno`, `Instrutor`, `Responsável`) rather than
from a second copy of the names (AC 1)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "lists the three roles in order"`

**C2** - `buildInviteUrl(academyId, role)` returns
`https://apptatame.com.br/convite/<encodeURIComponent(academyId)>?papel=<token>` with `aluno` for
`student`, `instrutor` for `instructor` and `responsavel` for `guardian`, and the result parses
back through `parseInviteLink` to the same academy id and role (AC 2)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "builds the invite url for each role"`
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "every url it builds is one parseInviteLink accepts"`

**C3** - The `guardian` option's description says the invite goes to the responsible adult, who
then registers the child - it contains `Responsável` nowhere as the invited minor and does
mention cadastrar/dependente (AC 3)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the guardian option explains it invites the adult"`

**C4** - `MembersListContent` renders the invite and share-app header actions only under
`showInviteActions`, which defaults to `false`; `(manager)/(members)/index.tsx` passes it and
`(instructor)/(members)/index.tsx` and `(student)/(members)/index.tsx` pass nothing (AC 4)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "only the manager members list asks for the invite actions"`

**C5** - `APP_DOWNLOAD_URL` is exactly `https://apptatame.com.br/baixar`, and `APP_SHARE_MESSAGE`
contains it, contains no `/convite/`, and is not the bare apex `https://apptatame.com.br` (AC 5)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the app message points at the download page"`

**C6** - `shareMessage` whose share call resolves `{ action: "dismissedAction" }` calls the error
reporter zero times and returns without throwing (AC 6)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "a dismissed sheet reports nothing"`

**C7** - `shareMessage` whose share call rejects calls the error reporter exactly once, with title
`Erro` and a body that is Brazilian Portuguese carrying at least one accented character (AC 7)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "a failed share raises one Portuguese alert"`

**C8** - `components/InviteRoleSheet.tsx` is a `Modal` taking `visible`, `onClose` and `onSelect`
that renders `SelectionCard` rows, and the file contains no reference to `ModalSelect` (AC 8)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the picker follows the DependentSelectionModal shape"`

**C9** - `shareMessage` whose share call resolves `{ action: "sharedAction" }` calls the error
reporter zero times - the negative control that keeps C7 from passing on a reporter that is never
called at all (AC 6, third member of the outcome set)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "a completed share reports nothing"`

### S2 - The dashboard quick action · 1 file · 14 KB · ~4k

**C10** - The `Ações rápidas` block in `app/(app)/(manager)/(home)/index.tsx` holds exactly five
quick-action cards - the four that exist today plus one (AC 10)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the manager home has five quick actions"`

**C11** - The fifth card's label is `INVITE_QUICK_ACTION_LABEL` from `lib/invite-share.ts` and its
press handler is the picker opener from `useInviteShare`, not a `Share.share` call of its own
(AC 9)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the fifth quick action opens the shared picker"`

### S3 - The empty-academy welcome card · 2 files · 16 KB · ~4k

**C12** - `shouldShowInviteWelcome(undefined)` is `false`, so neither a pending nor a failed
`useAcademyStats` can flash the card (AC 11)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "no member count means no card"`

**C13** - `shouldShowInviteWelcome` is `true` at `1` and `4` and `false` at `5` and `30`, against
`INVITE_WELCOME_MEMBER_THRESHOLD === 5` counted the way the API counts it - the manager's own
active membership included (AC 12, AC 13)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the card lives below five active members"`

**C14** - `app/(app)/(manager)/(home)/index.tsx` renders `InviteWelcomeCard` before the literal
`Ações rápidas`, gated on `shouldShowInviteWelcome`, and `components/InviteWelcomeCard.tsx` wires
both an invite press and a share-app press (AC 12, AC 14)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the welcome card sits above the quick actions and offers both actions"`

### S4 - One place decides the messages, the token and the labels · 4 files · 11 KB · ~3k

**C15** - `inviteShareMessage(academyName, url)` contains the academy name verbatim, contains the
url verbatim, carries at least one accented character, and contains group-addressed wording
rather than a singular invitation (AC 16)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the invite message names the academy and speaks to a group"`

**C16** - `inviteShareMessage` given `""`, `null` or `undefined` as the academy name returns the
no-academy phrasing, still contains the url, and contains neither a double space nor the empty
interpolation artefacts `` na `` at end-of-sentence nor `undefined` (AC 17)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "an unnamed academy loses the name, not the sentence"`

**C17** - None of the entry points holds its own copy of either message: `MembersListContent.tsx`,
`(manager)/(home)/index.tsx`, `InviteRoleSheet.tsx` and `InviteWelcomeCard.tsx` contain neither
`APP_SHARE_MESSAGE`'s text nor any fragment of the invite sentence, and each one that shares
imports from `@/lib/invite-share` (AC 15)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "no screen keeps its own copy of a message"`

**C18** - `ROLE_TO_PAPEL` in `packages/types/src/index.ts` has exactly three keys, one per
`InviteRole`, and `resolvePapelToRole(ROLE_TO_PAPEL[role]) === role` for all three - table-driven
over the whole set (AC 18, door 1)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "every role round-trips through its papel token"`

**C19** - Every label constant this feature adds - `INVITE_LABEL`, `SHARE_APP_LABEL`,
`INVITE_QUICK_ACTION_LABEL` - is at most 16 characters on each of its lines (AC 19)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "every new button label fits a mobile button"`

**C20** - `lib/hooks/use-invite-share.ts` is the only file under `apps/mobile/app` and
`apps/mobile/components` plus `apps/mobile/lib` that imports `Share` from `react-native` (door 3)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "one hook is the only importer of Share"`

**C21** - `lib/invite-share.ts` imports nothing from `react-native`, which is what keeps every
check above runnable under `environment: "node"` (pure-module constraint; door 2 itself is
proven by C9 and C23)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the share module stays pure"`

**C22** - `SelectionCard`'s new `description` is optional and `DependentSelectionModal` passes
none, so the check-in sheet is unchanged (Impact row)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the check-in sheet passes no description"`

### S5 - Gaps verification round 1 found · 4 files · 14 KB · ~4k

Added after round 1 reported a surviving mutant and three enumerations with no row. Every claim
above is unchanged; these close what their proofs left reachable.

**C23** - `lib/hooks/use-invite-share.ts` wires `APP_SHARE_MESSAGE` to the share-app action and
`inviteShareMessage` to the invite action - not the other way round - and hands `shareMessage`
only a `message` (door 2)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "each action is wired to its own message"`

**C24** - `SelectionCard` renders the `Icon` it is handed, and `description` takes precedence
over the belt line when a row carries both (Impact row)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the card renders the icon it is handed, and a description outranks the belt line"`

**C25** - `InviteRoleSheet` maps all three roles to three distinct glyphs and hands each one to
`SelectionCard`, so the rows are not three copies of the same avatar (AC 1)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "each role gets its own glyph"`

**C26** - `MembersListContent` renders `InviteHeaderActions` in the **true** branch of the
`showInviteActions` gate and `InviteRoleSheet` in the true branch of its own, so neither an
inverted gate nor swapped branches survives (AC 4)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the actions sit in the true branch of the gate"`

### S6 - Gaps verification round 2 found · 4 files · 16 KB · ~4k

Round 2 named one root cause for both its surviving mutants: every wiring proof above reads a
**definition** - which message a named function builds, which element sits in which branch - and
none reads a **call site** or a **prop binding**. These two checks are that surface, and nothing
above is changed.

**C27** - Every mount this feature writes hands each action the handler its name promises -
`onInvitePress` the picker opener and `onShareAppPress` the app share, at all four mount sites -
and inside `InviteHeaderActions` and `InviteWelcomeCard` each handler sits on the control its
glyph identifies, with no `</Pressable>` between them (AC 1, AC 5)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "every mount hands each action the handler its name promises"`
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "inside each component the handler sits on the control its glyph names"`

**C28** - `selectRole`'s body shares the invite and never the app message, `shareApp`'s body
never reaches for `inviteShareMessage` or `buildInviteUrl`, and `shareInvite`'s body never
reaches for `APP_SHARE_MESSAGE` - asserted over each `useCallback` body, not over the module
(AC 2, AC 5, door 2)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "picking a role shares the invite, never the app message"`
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the share-app action never reaches for the invite builder"`
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-share.test.ts -t "the invite action never reaches for the app message"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `InviteRole` -> `papel` token (3) | C18, table-driven over all 3; and `student` C2 · `instructor` C2 · `guardian` C2 | - |
| role picker rows (3) | `Aluno` C1 · `Instrutor` C1 · `Responsável` C1, C3 | - |
| entry points (3) | members header C4, C26 · home quick action C10, C11 · welcome card C14 | - |
| share actions (2) | invite C2, C15, C23 · share-app C5, C23 | - |
| `MembersListContent` consumers (3) | manager C4 · instructor C4 · student C4 | - |
| share-sheet outcomes (3) | `sharedAction` C9 · `dismissedAction` C6 · rejection C7 | - |
| welcome-card threshold edges (4) | no data C12 · `1` C13 · `4` C13 · `5` C13 | - |
| new button labels (3) | `Convidar` C19 · `Compartilhar app` C19 · `Convidar\nmembro` C19 | - |
| message definitions (2) | invite C15, C16, C17 · app C5, C17 | - |
| academy-name states in the invite message (4) | named C15 · `""` C16 · `null` C16 · `undefined` C16 | - |
| one-way doors (3) | door 1 C18 · door 2 C9, C23 · door 3 C20 | - |
| pure-module constraint (1) | `lib/invite-share.ts` imports no native runtime C21 | - |
| role glyphs in the picker (3) | `student` C25 · `instructor` C25 · `guardian` C25 | - |
| `SelectionCard`'s new props (2) | `description` C22, C24 · `Icon` C24, C25 | - |
| `showInviteActions` gate sites (2) | header actions C26 · picker mount C26 | - |
| prop bindings at mount sites (4) | header actions in `MembersListContent` C27 · picker in `MembersListContent` C27 · welcome card on the home C27 · picker on the home C27 | - |
| handler-to-control bindings inside the new components (4) | invite -> `UserPlus` in the header C27 · share-app -> `Share2` in the header C27 · invite -> `UserPlus` in the welcome card C27 · share-app -> `Share2` in the welcome card C27 | - |
| share call sites in the hook (3) | `selectRole` -> `shareInvite` C28 · `shareApp` -> `APP_SHARE_MESSAGE` C28 · `shareInvite` -> `inviteShareMessage` C28 | - |

- No check here claims a status code, a route or a response shape: this feature makes no request
  and adds no route (plan `Surface`: `None - nothing consumed outside`). Both URLs it produces are
  routes `apps/web` already serves, and C2's second proof is what ties the one it builds back to
  the parser that already exists.
- No other check claims more than the single case its proof exercises.
- Nothing in this feature runs before the first request, so there is no startup-configuration set.

## Test policy

`AGENTS.md` answers neither question for `apps/mobile`: it covers commit messages, branching,
language, styling, designs and billing, and says nothing about which level proves a given piece
of code or how much of its input space a proof must assert. `vitest.config.ts:7-13` explains the
`environment: "node"` choice - which is *how* a test is built, not what deserves one. So these
rows are written, and per the standing preference they stay here rather than in `AGENTS.md`.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, and the decision is reachable from more than one screen | one at its own layer, in a module that imports no `react-native` | one asserted case per row of the decision table, plus every boundary edge |
| Decides, reached from one screen only | one at its own layer | one asserted case per row of the decision table |
| Instrumentation that wires a decision module to a screen | one source-text assertion that the wiring exists and that no second copy of the decision does | the import, and the absence of a duplicate |
| Pure presentation - maps a prop onto a view with no conditional | none of its own | covered by the source-text assertion on its consumer |

Evidence:

- `lib/invite-share.ts`: dispatches over 3 roles, 1 numeric boundary (2 edges each side), 1
  empty-name branch with 3 falsy inputs, 1 dismiss-vs-reject-vs-shared branch - 4 decision tables,
  9 branch points -> **decides**, and reachable from all three entry points, so the first row
- `lib/hooks/use-invite-share.ts`: forwards `Share.share` and `Alert.alert` into `shareMessage`
  and holds one boolean of picker state; no conditional decides an outcome -> **instrumentation**
- `components/InviteRoleSheet.tsx`: maps `INVITE_ROLE_OPTIONS` onto `SelectionCard` rows, no
  conditional -> **pure presentation**
- `components/InviteWelcomeCard.tsx`: renders a sentence and two buttons from props, no
  conditional -> **pure presentation**
- `components/MembersListContent.tsx`: 1 new conditional, reached from three screens, plus both
  prop bindings -> **decides**, and the decision is the gate itself. Nothing in this repo can
  render it, so the gate's polarity and branch (C26), the bindings (C27) and the three consumers
  (C4) are each pinned in source text, enumerated rather than exempted
- `components/InviteHeaderActions.tsx`: renders two buttons from props, no conditional ->
  **pure presentation**; it exists as a named element precisely so C26 can pin which branch of
  the `showInviteActions` gate it sits in, and C27 which handler each button carries
- `components/SelectionCard.tsx`: 1 new conditional, picking which of two prop-derived lines to
  render - it changes no outcome and reaches nothing, so **pure presentation**. The precedence
  it decides is still selector-reachable in principle and nothing in this repo can render it, so
  it is pinned in source text instead (C24) rather than left under a blanket exemption
- `app/(app)/(manager)/(home)/index.tsx`: one new conditional, whose predicate is
  `shouldShowInviteWelcome` -> the decision is in the pure module (C12, C13); the screen is
  **instrumentation** and gets the source-text assertion (C14)
- closest analogue in the repo: `lib/invite-copy.ts` + `lib/invite-copy.test.ts` - the same shape
  (a pure table and a pure sentence builder feeding a screen), already proven at its own layer
  with 7 cases, and `lib/invite-copy.test.ts:72-85` is the existing precedent for the source-text
  assertion that stops a screen keeping a second copy of the copy. `lib/invite-link.ts` with 12
  cases is the second.

Cost: 28 proofs in one new test file, 19 of them pure and 19 source-text. Without these rows the
`papel` table, the threshold boundary and the dismiss-vs-reject branch would be proven only by a
manual tap on a device, which is the one thing the open question already says no test reaches.

## Swept

- validation: C2 (the academy id is url-encoded on the way out and survives `parseInviteLink` on
  the way back), C16 (the only other untrusted input this feature reads is an academy name that
  `useAcademyContext` initialises to `""`)
- failure modes: C7 - the share call rejecting is the only failure this feature can have
- idempotency: n/a - nothing is written, nothing is requested and nothing is sent; sharing the
  same link twice produces two identical messages and no state, so there is no key to dedupe on,
  and TAT-175 fixed the link as reusable by design
- authorization: C4, plus existing - `app/(app)/(manager)/_layout.tsx` already gates the whole
  manager group, so C4 covers the one surface that is shared across roles
- concurrency: n/a - one `visible` boolean owned by one screen; the picker is a `Modal`, so the
  screen behind it cannot receive a second tap while it is open, and the OS share sheet is modal
  for the same reason. There is no second writer of any state this feature reads
- data lifecycle: n/a - nothing persisted and nothing to expire; the link is non-expiring by
  TAT-175's design, which the plan's `Out of scope` records
- dependency failure: C7 - the OS share sheet is the only external dependency, and a rejected
  promise is the whole of its failure surface
- state transitions: C6, C7, C9 - the three terminal outcomes of one share attempt, each asserted
  separately so a reporter that is never called cannot pass two of them
- observability: n/a - `apps/mobile` has no logging, metric or trace layer (`AGENTS.md`'s
  no-`console.*` rule is scoped to `apps/api`), and nothing here reaches the API, so there is no
  event to emit and nowhere to emit it

## Handoff

- S1 = 20 KB -> ~5k; S2 adds 14 KB -> ~9k; S3 adds 16 KB -> ~13k; S4 adds 11 KB -> ~16k, counting
  `wc -c` over the 9 existing files touched plus the 5 new ones, divided by four. 16k against the
  150k budget - **one builder**, no cut.
- **Boundary:** C1-C28 closed. All 28 proofs green in `apps/mobile/lib/invite-share.test.ts`
  (38 tests); the mobile suite went 71 -> 109 tests, 9 files, all passing. `pnpm build` and
  `pnpm test:unit` green across the monorepo. `npx tsc --noEmit` in `apps/mobile` reports the
  same 5 pre-existing errors `.specs/STATE.md` already records and none in a file this feature
  wrote.
- **Settled mid-build:** the entry-point layout - members header carries both actions, `Ações
  rápidas` gains one card, the welcome card carries both (the user chose this over putting both
  in the grid). Nothing else needed a decision.
- **Abandoned:** nothing. Two early comments had to be reworded rather than the checks relaxed:
  `lib/invite-share.ts` named `react-native` in prose and `components/InviteRoleSheet.tsx` named
  `ModalSelect` in prose, and C21 and C8 are whole-file assertions on purpose - a file that never
  names either module cannot quietly start importing it.
