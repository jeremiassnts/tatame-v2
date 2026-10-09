# TAT-178 — Manager share and invite actions

## Problem

A manager who signs up, creates the academy and subscribes has no way inside the app to tell
anyone else that the app exists. `app/(app)/(manager)/(members)/index.tsx` offers search and six
filter tabs over a list that, for a new academy, contains exactly one row — the manager's own
active membership, which is what `activeMembers` counts (`academy.repository.postgres.ts:95-104`,
and `academy-membership.integration.test.ts:52` asserts `activeMembers: 1` for a fresh academy).
The four quick actions on `app/(app)/(manager)/(home)/index.tsx` cover pending requests,
schedule, payments and announcements — every one of them presupposes members who already joined.
`Share` from `react-native` appears nowhere in `apps/mobile`.

So the only route a manager has today is out-of-band: tell each person, one at a time, to find
"Tatame" in the store, install it, sign up, search for the academy by name and send a join
request. The manager pays for this in the one place it hurts — the academy stays empty, which is
the reported problem behind TAT-175: managers are using the platform but are not bringing
students and instructors in, because nothing in the app suggests they can.

The ticket gives no conversion figure and no support volume; it reports the behaviour only.

When this ships, a manager taps **Convidar** on the Members header, on the home quick actions,
or on an empty-academy welcome card, picks Aluno / Instrutor / Responsável, and the OS share
sheet opens with a finished Portuguese sentence carrying
`https://apptatame.com.br/convite/<academyId>?papel=<token>` — one link they paste once into a
WhatsApp group of thirty.

## Flow

Reuses rather than duplicates: the link vocabulary is `PAPEL_TO_ROLE` in `@tatame/types` (one
table, already parsed by `apps/web/lib/invite.ts` and `apps/mobile/lib/invite-link.ts`), the role
names are `ROLE_LABELS` in `lib/invite-copy.ts`, the sheet shape is `DependentSelectionModal`
over `SelectionCard`, the academy identity is `useAcademyContext`, and the member count is
`useAcademyStats`.

1. manager taps an entry point — `components/MembersListContent.tsx` (exists) header,
   `app/(app)/(manager)/(home)/index.tsx` (exists) quick action, or the welcome card on that same
   screen — and calls `useInviteShare` (new, no door — placement per conventions)
2. `useInviteShare` (new) either opens the picker (invite) or goes straight to the sheet
   (share-app), and is the one place `Share.share` (door 2) and `Alert.alert` are wired
3. `components/InviteRoleSheet.tsx` (new, no door — placement) renders `INVITE_ROLE_OPTIONS`
   (door 1) as `SelectionCard` (exists, gains an optional `description`) rows — hands one
   `InviteRole` back
4. `lib/invite-share.ts` (new, no door — placement) builds the URL from `ROLE_TO_PAPEL`
   (door 1) and the Portuguese message from the academy name — pure, no `react-native` import
5. out: the OS share sheet carries one `message` string; nothing persists, nothing is sent to the
   API, and `useAcademyStats` (exists) still decides the welcome card on the next render

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `ROLE_TO_PAPEL` — the inverse of `PAPEL_TO_ROLE`, role → the Portuguese query token, lives in `packages/types/src/index.ts` beside it. Who reads the token today: `apps/web/lib/invite.ts` and `apps/mobile/lib/invite-link.ts`, both parse-only — neither appears in this diff, and both break if the spelling drifts |
| domain | existing term: `activeMembers` meant "active memberships in the academy" and still does — but it **includes the manager's own**, so a brand-new academy reads `1`, not `0`. The welcome-card threshold is stated against that meaning (AC 12), not against "members the manager brought in". Who branches on it today: the Membros counter on the manager home |
| shared component | `SelectionCard` gains an optional `description`. `DependentSelectionModal` is its only consumer today and passes none, so the check-in sheet renders byte-identically |
| shared component | `MembersListContent` gains an opt-in `showInviteActions` prop defaulting to `false`. Its three consumers are the manager, instructor and student member lists; only the manager one passes it, so the other two are unchanged (AC 4) |
| stored data | nothing to migrate — no entity, no column, no row written, no request made |

## Relations

`None - no stored-data shape change`

## Surface

`None - nothing consumed outside`

Both URLs this feature shares are routes `apps/web` already serves and TAT-176 already shipped
(`apps/web/app/convite/[academyId]/page.tsx`, `apps/web/app/baixar/page.tsx`). This feature adds
no route and changes no signature; what it adds is a producer of the `?papel=` token whose
parser already exists in two apps, which is why that token is door 1 rather than a Surface row.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1 — where role → `papel` is decided, and that it is decided in exactly one place | `export const ROLE_TO_PAPEL: Record<InviteRole, string> = { student: "aluno", instructor: "instrutor", guardian: "responsavel" };` in `packages/types/src/index.ts`, directly under `PAPEL_TO_ROLE` | Inverting `PAPEL_TO_ROLE` at runtime (`Object.fromEntries(Object.entries(PAPEL_TO_ROLE).map(([p, r]) => [r, p]))`) — the inverse of a `Record<string, InviteRole>` is not typed `Record<InviteRole, string>`, so a role missing from the table becomes `undefined` inside a shared URL instead of a compile error. Also rejected: a local table in `apps/mobile/lib/invite-share.ts` — a second place to decide whether it is `responsavel` or `responsável`, after the links are already circulating |
| 2 — the share mechanism and the shape of what it carries | `await Share.share({ message })` from `react-native` — one string, no `url` key, the link inlined in the sentence | `Share.share({ message, url })` — iOS hands `UIActivityViewController` two separate activity items and the receiving app chooses which to take, so the academy name and the "é para o grupo todo" sentence are not guaranteed to travel with the link. A single `message` always arrives whole. Also rejected: `expo-sharing`, which shares local files and has no text path |
| 3 — the first share in `apps/mobile`, and therefore the pattern the next feature copies | one hook, `lib/hooks/use-invite-share.ts`, is the only module in `apps/mobile` that imports `Share`; every entry point calls it and none calls `Share.share` itself | `Share.share` inline at each of the three entry points — three copies of the dismiss-vs-reject handling, which is the branch that gets written once correctly and then copied wrong |

- Nothing else in this change is hard to reverse: the threshold constant, the picker's row order,
  the copy, the `description` prop and the `showInviteActions` prop are all one-commit reversals.

## Criteria

### S1: A manager invites a member from the Members screen (P1)

The primary, always-available entry point, and the one the ticket calls the piece that addresses
the reported problem.

**Acceptance Criteria**

1. WHEN a manager taps `Convidar` in the Members screen header THEN the system SHALL open a role
   picker listing exactly three rows, labelled `Aluno`, `Instrutor` and `Responsável`, in that
   order.
2. WHEN the manager picks a row in that picker THEN the system SHALL open the OS share sheet with
   a message containing `https://apptatame.com.br/convite/<academyId>?papel=<token>`, where
   `<token>` is `aluno` for `Aluno`, `instrutor` for `Instrutor` and `responsavel` for
   `Responsável`.
3. The `Responsável` row SHALL carry a description stating that the invite goes to the
   responsible adult, who then registers the child as a dependent.
4. WHILE `MembersListContent` is rendered by the instructor or the student member list it SHALL
   render neither the invite action nor the share-app action in its header.
5. WHEN a manager taps the share-app action in the Members screen header THEN the system SHALL
   open the OS share sheet with a message containing `https://apptatame.com.br/baixar` and no
   `/convite/` path.
6. IF the share sheet is dismissed without a target THEN the system SHALL return without raising
   an alert and without changing any screen state.
7. IF the share call rejects THEN the system SHALL raise exactly one
   `Alert.alert("Erro", …)` whose body is in Brazilian Portuguese.
8. The role picker SHALL be a `Modal` with `visible` / `onClose` / `onSelect` rendering
   `SelectionCard` rows, as `components/DependentSelectionModal.tsx` does, and SHALL not import
   `components/ModalSelect.tsx`.

**Independent test:** open the manager Members screen on a device, tap `Convidar`, pick
`Instrutor`, confirm the sheet carries `?papel=instrutor`; then open the instructor Members
screen and confirm the header has neither action.

### S2: The dashboard offers the invite (P1)

**Acceptance Criteria**

9. WHEN a manager taps the invite card in `Ações rápidas` on the manager home THEN the system SHALL
   open the same role picker as AC 1.
10. The `Ações rápidas` block on the manager home SHALL contain exactly five cards — the four
    that exist today plus the invite card.

**Independent test:** open the manager home, count five quick-action cards, tap the new one and
confirm the same three-row picker opens.

### S3: An empty academy is asked to fill itself (P2)

**Acceptance Criteria**

11. WHILE `useAcademyStats` has produced no data the manager home SHALL render no welcome card.
12. WHILE `activeMembers` is below `5` the manager home SHALL render the welcome card above the
    `Ações rápidas` heading.
13. WHILE `activeMembers` is `5` or above the manager home SHALL render no welcome card.
14. The welcome card SHALL offer both the invite action and the share-app action.

**Independent test:** with a fresh academy (`activeMembers: 1`) the card is on the home; with a
stubbed count of `5` it is gone.

### S4: One place decides the two messages and the token (P1)

**Acceptance Criteria**

15. The system SHALL define both share messages in `apps/mobile/lib/invite-share.ts`, and every
    entry point SHALL read them from there rather than holding its own string.
16. The invite message SHALL be in Brazilian Portuguese with correct accentuation, SHALL contain
    the academy name, and SHALL contain wording addressed to a group rather than to one person.
17. IF the academy name in context is empty THEN the invite message SHALL use phrasing that names
    no academy rather than interpolating an empty string.
18. The system SHALL map each `InviteRole` to its `papel` token through exactly one table,
    `ROLE_TO_PAPEL` in `packages/types/src/index.ts`, and `resolvePapelToRole(ROLE_TO_PAPEL[r])`
    SHALL equal `r` for each of the three roles.
19. The system SHALL render every button label this feature adds at 16 characters or fewer.

**Independent test:** `pnpm --filter @tatame/mobile test` proves 15–19 without a device; grep
proves no second copy of either message.

## Out of scope

| Excluded | Why |
| --- | --- |
| A per-person or single-use invite token | TAT-175 fixed the link as non-expiring, not-per-person and seat-free; a token would change the already-shipped `apps/web` invite page and the `parseInviteLink` contract |
| Any "invite sent to X" / pending-invite tracking state | Follows directly from the above — there is no recipient to track, and the manager posts one link to a group |
| Inviting a manager | `InviteRole` excludes `manager` by construction (`packages/types/src/index.ts:13`) — a manager owns an academy rather than joining one |
| Copy-to-clipboard or a QR code as alternatives to the share sheet | The ticket asks for the native share sheet; `expo-clipboard` is already a dependency, so this stays a cheap later slice |
| An invite affordance for instructors | The ticket scopes both actions to the manager, and AC 4 is the criterion that keeps it that way |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Whether this feature adds a React Native renderer to the mobile test setup so the screens can be asserted on | No. `vitest.config.ts` runs `environment: "node"` and nothing is rendered; the URL, the two messages, the three role options, the threshold predicate and the dismiss-vs-reject branch are extracted into pure modules and tested directly, and the wiring (which screen imports which hook) is covered by source-text assertions the way TAT-177 and TAT-191 did | Adding `@testing-library/react-native` plus jsdom is a new dependency and a new precedent — a `Landing` door — in a feature whose own scope is three entry points. The pure/wiring split proves AC 1–3 and 15–19 outright and leaves only arrangement to review in the diff. `.specs/STATE.md` already records that `apps/mobile` has no typecheck and no lint, so source-text assertions are the standing substitute | n |
| What `apps/web` shows when a `papel` token is shared that it cannot resolve | Nothing to decide — `resolvePapelToRole` degrades an unresolvable token to "no suggested role" and the invite page still works (`packages/types/src/index.ts:35-50`). AC 18's round-trip is what stops this feature producing one | Already settled in shipped code; re-deciding it here would be a second answer | y |
| Which icon the share-app action uses | `Share2` from `lucide-react-native`, matching the icon-only 40×40 header button shape already used for the back arrow in `MembersListContent` | The library is already a dependency and every other action on these screens is a lucide glyph | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | Has a store build with the real share sheet been exercised on both an iOS and an Android device? | AC 2, 5, 6 and 7 are proven as pure functions and as wiring, but "the sheet opens and the message arrives whole" is an OS behaviour no node test reaches. The feature is shippable; this is the manual pass before release |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `(manager)/(members)/index` | empty state | existing - `ListEmptyComponent` renders `Nenhum membro encontrado`; unchanged by this feature |
| screen `(manager)/(members)/index` | loading state | existing - the `isPending` `ActivityIndicator` already in `MembersListContent`; the header actions do not wait on it |
| screen `(manager)/(members)/index` | error state | n/a - this feature adds no fetch to the screen; the link is built from `useAcademyContext`, which is already resolved before the screen mounts |
| screen `(manager)/(members)/index` | unauthorised state | AC 4 |
| screen `(manager)/(members)/index` | destructive action confirms | n/a - sharing a non-expiring, non-per-person link writes nothing and revokes nothing; there is no destructive action to confirm |
| screen `(manager)/(members)/index` | density and ordering of the new header actions | AC 19 and the approved layout - share-app icon, then `Convidar`, right of the title |
| modal `InviteRoleSheet` | empty state | n/a - the three rows are a compile-time constant, never a fetch, so the list cannot be empty |
| modal `InviteRoleSheet` | loading state | n/a - same reason; nothing is awaited before the rows render |
| modal `InviteRoleSheet` | error state | AC 7 |
| modal `InviteRoleSheet` | unauthorised state | n/a - it is only mounted from manager-only entry points, which AC 4 is the criterion for |
| modal `InviteRoleSheet` | density and ordering | AC 1 |
| modal `InviteRoleSheet` | destructive action confirms | n/a - picking a role opens a share sheet the manager can dismiss (AC 6); nothing is committed |
| screen `(manager)/(home)` | empty state | AC 12 - the welcome card *is* this screen's empty state |
| screen `(manager)/(home)` | loading state | AC 11 |
| screen `(manager)/(home)` | error state | AC 11 - a failed `useAcademyStats` leaves `data` undefined, which is the same no-card branch |
| screen `(manager)/(home)` | density and ordering | AC 10, AC 12 |
| screen `(manager)/(home)` | unauthorised state | existing - `(manager)/_layout.tsx` already gates the whole group |
| screen `(manager)/(home)` | destructive action confirms | n/a - both new actions only open a share sheet |
| copy `invite message` | structure, tone, depth, what the reader does next | AC 16, AC 17 |
| copy `app message` | structure, tone, depth, what the reader does next | AC 5 - it carries `/baixar`, where the reader installs the app |
| copy both messages | where they live, so they are updated once | AC 15 |

## Sources

- TAT-178 — the two actions, the three entry points, the `DependentSelectionModal` precedent, the
  `/baixar`-not-`/` rule, and that the link is one-to-many
- `packages/types/src/index.ts:17-50` — binds the `papel` vocabulary and the exact-match rule
  this feature must produce tokens for
- `apps/web/app/baixar/page.tsx:13-18` — binds `/baixar` as where "share the app" lands
