# TAT-191 - Carry the pending invite through sign up and onboarding

## Problem

A manager pastes `apptatame.com.br/convite/<academyId>?papel=aluno` into a WhatsApp group. TAT-176
built the page behind that link and TAT-177 taught the app to claim it, parse it and hand the
`academyId` and the suggested `papel` to `apps/mobile/lib/pending-invite.ts`. **Nothing reads that
module.** `grep -rn "readPendingInvite" apps/mobile` returns one hit, its own test.

So the person who taps the link still arrives where they always did. `apps/mobile/app/(app)/index.tsx`
sees no `activeRole` and sends them to `(onboarding)/user-type`, which hardcodes
`useState<UserType>("student")`; they pick a role, land in `(joining)/search-academy`, and type the
academy's name into a search box. The invite named the academy and the role, and both were discarded
between the operating system handing over the URL and the first screen the person sees.

The invited person pays for it twice. They have to know the academy's name as it was typed into the
system - `searchByName` is a substring match on `academies.name`, so "Alliance" finds nothing if the
manager registered "Equipe Alliance Centro". And an invite that said `papel=instrutor` produces a
`student` membership request unless the person notices the pre-selected card and changes it, because
`POST /memberships/requests` takes the role from `req.appAuth!.role` and never from the body.

The ticket gives no conversion figure. It gives one hard constraint instead, which is the shape of
the whole feature: the role step **cannot** be skipped, because a user with `activeRole === null`
gets a 403 from `authorize(Role.Instructor, Role.Student, Role.Guardian)`.

When this ships, tapping an invite link ends on that academy's join screen with the invited role
already selected, and the person never sees a search box.

## Flow

The invite does not get a second set of routing rules: `app/(app)/index.tsx` already knows auth
state, role, membership and membership status and already drives every destination with
`router.replace`, so this feature changes what those existing rules decide, not where they live.

One thing this does **not** reuse, and the reason belongs here rather than in a commit message:
`lib/api-error-message.ts#describeApiError` (TAT-186) already turns an `ApiError` into a sentence,
and `lib/membership-errors.ts` is a second module next to it on purpose. `describeApiError` falls
back to `error.message` for any uncoded failure that is not in its `TRANSLATED` allowlist, and all
three membership failures are uncoded - so it would answer `"You already have an active academy
membership; leave before joining another"`, which is the exact defect AC 43 forbids. More decisive:
the two 409s are told apart by whether `/users/me` reports a membership, and `describeApiError` sees
only the error - its `fallback` argument cannot carry it either, because an uncoded 409 returns
before reaching it. Widening it to take a second argument would change the sentence on **9 files and
9 call sites** that never asked for it. (Verification round 2 checked all four of these sub-claims
against the code and found the first three exactly right; the count was written as "fifteen" and is
corrected here. The constraint this leaves behind is `AD-001` in `.specs/STATE.md`.)

1. OS URL -> `app/+native-intent.ts` (exists) - `parseInviteLink`, `setPendingInvite`, returns `/`
2. `lib/pending-invite.ts` (exists, changes) - holds the invite in module state **and** mirrors it
   to AsyncStorage under one key (door 1); exposes a synchronous snapshot, a subscription, and a
   one-shot hydrate
3. `lib/hooks/use-pending-invite.ts` (new, no door - placement per conventions) - kicks hydration
   once and subscribes the snapshot into React
4. `app/(app)/index.tsx` (exists) - reads the snapshot, calls the resolver, issues at most one
   `router.replace` per mount (door 3), and clears the invite when the resolver says it is spent
5. `lib/gatekeeper.ts` (new, door 2) - pure: `(isSignedIn, user, invite) -> { route, clearInvite }`.
   No React, no navigation, no storage
6. `app/(onboarding)/user-type.tsx` (exists) - reads the same snapshot, seeds the selection from
   `invite.role`, renders the headline from `lib/invite-copy.ts` (new), and still ends on
   `router.replace("/(app)")` so step 4 decides where the invite lands (door 4)
7. `lib/api.ts` (exists, changes) and `lib/hooks/use-academy.ts` (exists, changes) - call
   `GET /academies/:id/public`, the unauthenticated route TAT-176 added, to name the academy in
   that headline
8. `app/(app)/(joining)/academy/[academyId].tsx` (exists, changes) - renders a Brazilian Portuguese
   message instead of a forever-spinner when the academy will not load, maps the request failure
   through `lib/membership-errors.ts` (new), and hands navigation back to step 4 on success
9. `app/(app)/(joining)/already-member.tsx` (new, no door) - the friendly end for someone whose
   invite points at an academy other than the one they belong to
10. out: `POST /memberships/requests` unchanged; AsyncStorage holds no invite once a membership row
    exists

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `pending invite` - the `{ academyId, role }` an inbound link left behind, owned by `lib/pending-invite.ts`. TAT-177 named the type; this feature gives it a lifetime |
| domain | new term: `gatekeeper decision` - `{ route, clearInvite }`, the whole output of `lib/gatekeeper.ts`. `route: null` means "not enough is known yet, stay put", which is the behaviour `(app)/index.tsx` has today when `isPending` |
| domain | existing term: `PendingInvite` keeps its shape (`{ academyId, role }`) and loses its "one JS context" lifetime. Only `+native-intent.ts` writes it today, and it keeps compiling unchanged |
| domain | existing term: `clearPendingInvite` becomes `async` because removing the mirrored key is. `lib/pending-invite.test.ts` is the only caller and it is updated in the same commit |
| stored data | nothing to migrate. The one new persisted thing is an AsyncStorage key on the device (door 1); no Postgres column, no API change, no backfill |
| stored data | `apps/mobile/lib/notifications.ts` already writes to AsyncStorage (`getDeviceId`). The new key does not collide with any key it uses |
| UI copy | `(onboarding)/user-type` gains a header block above its title; its three `ROLES` labels stop being inline literals and come from `lib/invite-copy.ts`, so the invite headline and the cards cannot name the same role differently. `apps/web/lib/invite.ts` keeps its own `ROLE_LABELS` - a different app, a different bundle, already shipped |
| routing | `academy/[academyId].tsx` stops choosing between `pending-approval` and `/(app)` on success and replaces to `/(app)` in both cases. One authority, and it is the one the ticket names |

## Relations

`None - no stored-data shape change.` The invite is persisted on the device, not in Postgres, and
its shape is `Landing` door 1.

## Surface

`None - nothing consumed outside.` No route is added and no signature changes.
`GET /academies/:academyId/public` and `POST /memberships/requests` are both consumed exactly as
they are.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. The invite is persisted on the device under one AsyncStorage key, with module state as the synchronous source of truth and the key as a mirror | key `tatame.pending-invite`, value `JSON.stringify({ academyId, role })`, `role` one of `"student" \| "instructor" \| "guardian" \| null`. Read path: module state when hydrated, else `JSON.parse` + validate, else `null` | AsyncStorage alone: `redirectSystemPath` is synchronous and returns a string, so it cannot await the write, and the gatekeeper's read would then race a write nobody ordered. `SecureStore`: the ticket forbids it and an academy id is not a secret |
| 2. The gatekeeper's decision is a pure function in `lib/gatekeeper.ts` with exactly one consumer, `app/(app)/index.tsx` | `resolveGatekeeperRoute({ isSignedIn, user, invite }) -> { route: string \| null, clearInvite: boolean }` | Deciding inline in the `useEffect`, as today: the fourteen-row table below is the feature, and in `apps/mobile`'s node-only vitest harness a function inside a component cannot be asserted at all. Teaching each screen to defend itself was rejected by the ticket |
| 3. `(app)/index.tsx` issues at most one `router.replace` per mount, guarded by a ref | `const navigated = useRef(false)` checked and set inside the routing effect | Letting the effect re-run on every input change: clearing the invite emits a new snapshot synchronously, so the effect would re-decide with `invite: null` and bounce the person off the screen it had just chosen |
| 4. `user-type`'s `handleContinue` keeps `router.replace("/(app)")` and does **not** navigate to `(joining)/academy/<academyId>` itself | unchanged line `router.replace("/(app)")`, after `syncUser` and the `["user","me"]` refetch | Replacing straight to `(joining)/academy/<id>`, which is what the ticket's prose describes: it puts the academy-vs-search-vs-already-a-member choice in a second file, contradicting the ticket's own "routing decisions stay in `(app)/index.tsx`" criterion. The destination is identical because door 2's table decides it one hop later |
| 5. The invite's lifetime ends when a membership row exists, with no TTL | cleared when `user.activeMembership !== null`, or when `activeRole === "manager"` | A timestamp plus an expiry window: it adds a second reason an invite can vanish, and the stale-invite case the ticket names ("joined months ago") is already settled by the membership row that joining created |

| 6. `ApiError` lives in `lib/api-error.ts`, imported by anything that decides *what to say* about a failure; `lib/api.ts` re-exports it | `export class ApiError extends Error` moved verbatim into `lib/api-error.ts`, plus `export { ApiError } from "@/lib/api-error";` in `lib/api.ts`, so every existing `import { ApiError } from "@/lib/api"` is unchanged | Duck-typing on `error instanceof Error && "status" in error`: it accepts any object that happens to carry a `status`, so a fetch failure with a `status` field would be classified as an API answer. Keeping the class in `lib/api.ts` was not an option - that file imports `@clerk/clerk-expo`, which imports `react-native`, so an `instanceof` reached through it is a check the node harness cannot run at all |

- Nothing else in this change is hard to reverse. The copy, the error sentences, the new screen's
  layout and the module boundaries other than doors 2 and 6 are all settled in the diff.
- **Door 6 was found while building** and is recorded after the commit that introduced it rather
  than before, which is the one place this build broke its own rule. The alternative above is the
  one that was actually weighed at the time, not a reconstruction: the split happened because
  `membership-errors.test.ts` would not load, and duck-typing was the other way out of that.

## Criteria

### S1: the invite survives and the gatekeeper routes by it (P1)

A pure decision table turns auth state, role, membership and a pending invite into one destination.

**Acceptance Criteria**

1. WHEN `resolveGatekeeperRoute` gets `isSignedIn: false` THEN the system SHALL return `route: "/(auth)"` and `clearInvite: false`, whatever the invite holds
2. WHEN `resolveGatekeeperRoute` gets `isSignedIn: true` with `user: null` THEN the system SHALL return `route: null` and `clearInvite: false`
3. WHEN `resolveGatekeeperRoute` gets `activeRole: null` THEN the system SHALL return `route: "/(onboarding)/user-type"` and `clearInvite: false`, whatever the invite holds
4. WHEN `resolveGatekeeperRoute` gets `activeRole: "manager"` with no `activeAcademy` THEN the system SHALL return `route: "/(app)/create-academy"` and `clearInvite: true`
5. WHEN `resolveGatekeeperRoute` gets `activeRole: "manager"` with an `activeAcademy` THEN the system SHALL return `route: "/(app)/(manager)/(home)"` and `clearInvite: true`
6. WHEN `resolveGatekeeperRoute` gets a member role with `activeMembership: null` and `invite: null` THEN the system SHALL return `route: "/(app)/(joining)/search-academy"` and `clearInvite: false`
7. WHEN `resolveGatekeeperRoute` gets a member role with `activeMembership: null` and an invite naming `"a1"` THEN the system SHALL return `route: "/(app)/(joining)/academy/a1"` and `clearInvite: false`
8. WHEN `resolveGatekeeperRoute` gets a member role with `activeMembership.status: "pending"` THEN the system SHALL return `route: "/(app)/(joining)/pending-approval"` and `clearInvite: true`, whatever the invite holds
9. WHEN `resolveGatekeeperRoute` gets `activeRole: "student"` with `activeMembership.status: "active"` and no invite for another academy THEN the system SHALL return `route: "/(app)/(student)/(home)"` and `clearInvite: true`
10. WHEN `resolveGatekeeperRoute` gets `activeRole: "instructor"` with `activeMembership.status: "active"` and no invite for another academy THEN the system SHALL return `route: "/(app)/(instructor)/(home)"` and `clearInvite: true`
11. WHEN `resolveGatekeeperRoute` gets `activeRole: "guardian"` with `activeMembership.status: "active"` and no invite for another academy THEN the system SHALL return `route: "/(app)/(guardian)/(home)"` and `clearInvite: true`
12. WHEN `resolveGatekeeperRoute` gets a member role with an `"active"` membership in `"a1"` and an invite naming `"a2"` THEN the system SHALL return `route: "/(app)/(joining)/already-member"` and `clearInvite: true`
13. WHEN `resolveGatekeeperRoute` gets a member role with an `"active"` membership in `"a1"` and an invite naming `"a1"` THEN the system SHALL return that role's home route and `clearInvite: true`
14. IF `resolveGatekeeperRoute` gets a member role with `activeMembership.status: "blocked"` THEN the system SHALL return `route: null` and `clearInvite: false`, the destination `(app)/index.tsx` chooses today
15. The system SHALL return a `route` string or `null` for every input `resolveGatekeeperRoute` is given, and SHALL never throw
16. WHILE `(app)/index.tsx` stays mounted the system SHALL issue at most one `router.replace`
17. The system SHALL map auth state, role and membership to a route in exactly one module, `apps/mobile/lib/gatekeeper.ts`, and `app/(app)/index.tsx` SHALL be its only importer

**Independent test:** `pnpm --filter @tatame/mobile test lib/gatekeeper.test.ts` - the table is
settled by inputs and outputs with no renderer.

### S2: the invite outlives the auth detour and dies when it is spent (P1)

AsyncStorage behind the signatures TAT-177 left, plus the rules that end the invite's life.

**Acceptance Criteria**

18. WHEN `setPendingInvite` is called THEN the system SHALL make the invite readable from `getPendingInviteSnapshot()` synchronously, before any storage write resolves
19. WHEN `setPendingInvite` is called THEN the system SHALL write `JSON.stringify({ academyId, role })` to AsyncStorage key `tatame.pending-invite`
20. WHEN `hydratePendingInvite` runs in a fresh module while `tatame.pending-invite` holds `{"academyId":"a1","role":"instructor"}` THEN the system SHALL make that invite readable from `getPendingInviteSnapshot()`
21. WHEN `clearPendingInvite` is called THEN the system SHALL remove AsyncStorage key `tatame.pending-invite` and make `getPendingInviteSnapshot().invite` `null`
22. IF the persisted value is absent, not JSON, not an object, carries an `academyId` that is not a non-empty string, or carries a `role` outside `"student" | "instructor" | "guardian" | null` THEN the system SHALL hydrate to `invite: null` rather than throwing or yielding a partial invite
23. IF an AsyncStorage read or write rejects THEN the system SHALL leave module state intact and SHALL not propagate the rejection to the caller
24. WHEN `hydratePendingInvite` is called a second time THEN the system SHALL make no further AsyncStorage read
25. WHEN the snapshot changes THEN the system SHALL notify every subscriber registered through `subscribeToPendingInvite`, and SHALL notify none that has unsubscribed
26. The system SHALL return the identical snapshot object from two reads with no intervening write, so `useSyncExternalStore` does not loop

**Independent test:** `pnpm --filter @tatame/mobile test lib/pending-invite.test.ts` with
AsyncStorage replaced by an in-memory double.

### S3: the role step carries the invite's context (P1)

The invited person sees which academy invited them and as what, with the choice still theirs.

**Acceptance Criteria**

27. WHEN the invite names role `"instructor"` and the academy is named `"Alliance Centro"` THEN the system SHALL produce the headline `"Você foi convidado para ser Instrutor na Alliance Centro"`
28. WHEN the invite names a role and the academy's name is not available THEN the system SHALL produce a headline naming the role and no academy, containing neither `"null"` nor `"undefined"`
29. WHEN the invite names no role and the academy is named `"Alliance Centro"` THEN the system SHALL produce the headline `"Você foi convidado para entrar na Alliance Centro"`
30. WHEN the invite names no role and the academy's name is not available THEN the system SHALL produce a headline naming neither
31. WHERE a role was suggested the system SHALL produce the sentence `"Você pode escolher outro perfil se preferir."`, and WHERE none was it SHALL produce `"Selecione o seu perfil para continuar."`
32. The system SHALL label `"student"`, `"instructor"` and `"guardian"` as `"Aluno"`, `"Instrutor"` and `"Responsável"` from exactly one module in `apps/mobile`, read by both the headline and the role cards
33. WHILE a pending invite names role `R`, the `user-type` screen SHALL open with `R` selected, and WHILE no pending invite names a role it SHALL open with `"student"` selected
34. WHEN the person taps a role card the system SHALL select that role and SHALL keep it selected when the invite's academy name arrives afterwards
35. WHEN `handleContinue` succeeds the system SHALL call `syncUser` with the role currently selected, not with the invite's suggested role

**Independent test:** `pnpm --filter @tatame/mobile test lib/invite-copy.test.ts` for the strings;
the seeding and the card tap are a manual pass, see `## Assumptions`.

### S4: every dead end becomes a sentence in Brazilian Portuguese (P2)

**Acceptance Criteria**

36. IF `POST /memberships/requests` answers `403` THEN the system SHALL produce `"Você não pode solicitar entrada nesta academia novamente até que um gestor libere seu acesso."`
37. IF `POST /memberships/requests` answers `409` WHILE the person already has a membership THEN the system SHALL produce `"Você já faz parte de uma academia. Saia da atual antes de entrar em outra."`
38. IF `POST /memberships/requests` answers `409` WHILE the person has no membership THEN the system SHALL produce `"Você já tem uma solicitação pendente nesta academia."`
39. IF `POST /memberships/requests` answers `404` or `400` THEN the system SHALL produce `"Academia não encontrada. Peça um link de convite novo ao gestor."`
40. IF the request fails with anything that is not an `ApiError` THEN the system SHALL produce `"Não foi possível enviar sua solicitação. Tente novamente."`
41. IF `GET /academies/:academyId` answers `404` or `400` THEN the system SHALL produce `"Academia não encontrada. O link de convite pode estar inválido."` and the `academy/[academyId]` screen SHALL render it instead of the activity indicator it shows today
42. IF `GET /academies/:academyId` fails with anything else THEN the system SHALL produce `"Não foi possível carregar a academia. Verifique sua conexão e tente novamente."` and that screen SHALL render it with a retry
43. The system SHALL write every sentence in 36-42 in Brazilian Portuguese with its accents, and SHALL never show `ApiError.message` on either screen
44. WHEN a membership request succeeds the system SHALL replace to `/(app)` for both the `pending` and the `active` response status, leaving the destination to criterion 8 or 9-11

**Independent test:** `pnpm --filter @tatame/mobile test lib/membership-errors.test.ts`.

### S5: the three role endings (P2)

**Acceptance Criteria**

45. The system SHALL leave `(app)/(guardian)/(home)/index.tsx`'s redirect to `(guardian)/(onboarding)/register-dependent` unchanged, so an approved guardian invite ends at registering a dependent rather than at an empty home
46. The system SHALL keep the mobile suite green at the 27 pre-existing tests plus the ones this feature adds, and SHALL keep `pnpm lint` and `pnpm typecheck` at their current counts

**Independent test:** `pnpm test` from the repository root.

## Out of scope

| Excluded | Why |
| --- | --- |
| Invite framing on `(joining)/academy/[academyId]` | The ticket's criteria ask for the context on `user-type` only. The screen already names the academy it is about, so the framing would be decoration on the one screen that cannot be mistaken |
| A destination for `activeMembership.status === "blocked"` | `findActiveOrPendingByUser` filters to `["pending","active"]`, so the API cannot produce it. Criterion 14 pins today's behaviour; inventing a screen would ship a branch nothing can reach |
| A single-use or per-person invite link | The ticket requires the opposite: the same link works for several people in sequence. No link state exists anywhere, which is what makes that true |
| Resuming an invite after the person signs out | Signing out is a deliberate exit. The invite stays in AsyncStorage and so still applies on the next sign-in, but nothing is built to guarantee it |
| A React Native render harness for `apps/mobile` | The maintainer is building it separately. See `## Assumptions` |
| `pnpm typecheck` for `apps/mobile` | Its script is `echo 'skipped: NativeWind className types need metro plugin'`. Pre-existing, found again by TAT-177, and not this feature's to fix |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| The UI half of this feature cannot be proven by rendering: `apps/mobile/vitest.config.ts` sets `environment: "node"` and says a renderer would add setup nothing asserts | Every decision and every sentence moves into a pure module proven in node - `lib/gatekeeper.ts`, `lib/invite-copy.ts`, `lib/membership-errors.ts`, `lib/pending-invite.ts` - and the screens become wiring that no automated test covers. The maintainer tests the wiring by hand with the roteiro in `checks.md`, and builds the render harness afterwards | The maintainer's decision, asked and answered: "vou testar manualmente ao final da task e depois eu monto um harness de teste para o react native" | y |
| Which academy name the headline uses | `GET /academies/:academyId/public`, the unauthenticated route TAT-176 added for exactly this. `user-type` runs before any membership exists, so the authenticated `GET /academies/:academyId` would be the wrong tool even though a session exists by then | `getPublicById` returns three fields on purpose, and a uuid is all the caller has | n |
| Whether the `exp://` Expo Go link form still has to work | Yes, unchanged. `parseInviteLink` already handles it and it is the only form testable on the phone this project is developed on | TAT-177 built it for that reason; this feature adds nothing native | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | `IOS_APP_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` are still unset, so both `/.well-known/*` routes answer 404 and neither OS verifies `apptatame.com.br` | The `https://` form of the link still opens a browser on a real phone. Everything here is exercised through the `tatame:///` and `exp://` forms, which do not need the domain claim. Inherited from TAT-176 and TAT-177, not introduced here |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `(onboarding)/user-type` | empty state | n/a - the three role cards are a constant, never a fetched list |
| screen `(onboarding)/user-type` | loading state | AC 28 - the academy name is the only thing fetched, and its absence is a headline variant rather than a spinner |
| screen `(onboarding)/user-type` | error state | AC 28 - a failed name lookup degrades to the no-name headline; the role step stays usable |
| screen `(onboarding)/user-type` | unauthorised state | existing - reached only from `(app)/index.tsx`, which sends a signed-out user to `(auth)` first (AC 1) |
| screen `(onboarding)/user-type` | density and ordering | existing - instructor, student, guardian, the order the `ROLES` constant already has |
| screen `(onboarding)/user-type` | destructive action confirms | n/a - choosing a role is reversible until Continuar, and `syncUser` is idempotent |
| screen `(joining)/academy/[academyId]` | empty state | n/a - one academy, not a list |
| screen `(joining)/academy/[academyId]` | loading state | existing - the `ActivityIndicator` already there |
| screen `(joining)/academy/[academyId]` | error state | AC 41, AC 42 - the gap this feature closes; today an error renders the spinner forever |
| screen `(joining)/academy/[academyId]` | unauthorised state | AC 36 - the 403 from `existsBlockedOrRejected` |
| screen `(joining)/academy/[academyId]` | destructive action confirms | n/a - requesting entry is undone by `pending-approval`'s existing cancel |
| screen `(joining)/already-member` | empty, loading and error states | n/a - AC 12 reaches it only once `activeMembership` is loaded and active, so it fetches nothing that could be empty or fail |
| screen `(joining)/already-member` | what the reader does next | AC 12 - one action back to `/(app)`, which now routes them home because the invite is cleared |
| copy - the invite headline and the five dead ends | structure, tone, depth | AC 27-31, AC 36-43 |
| API `GET /academies/:academyId/public`, `POST /memberships/requests` | response shape, error shape and codes, who may call, versioning, rate limits | existing - both consumed unchanged, neither added nor re-signed by this feature |

## Sources

- TAT-191 - the thirteen acceptance criteria, the four-row destination table, and the AsyncStorage
  and "the role step cannot be skipped" constraints
- TAT-177 / PR #30 - `lib/pending-invite.ts`'s signatures and the note that TAT-191 is the ticket
  that decides what the invite must survive
- `apps/mobile/vitest.config.ts` - `environment: "node"`, which is why every obligation above is
  written against a module and not a screen
