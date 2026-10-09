# TAT-191 checks

Profile: standard
Plan: `.specs/features/tat-191-pending-invite/plan.md`

45 checks in 5 slices · 5 one-way doors · 1 open question, which blocks go-live only

Eight approved criteria have **no automated proof** and are covered by the manual roteiro in
`## Manual`: AC 16, 33, 34, 35, the rendering halves of AC 41 and 42, AC 43's screen clause, and
AC 45 end to end. That is the cost of the maintainer's decision recorded in the plan's
`## Assumptions`, and it is named here rather than left for the Verifier to discover.

## Checks

### S1 - the gatekeeper decision table · 2 files · 4 KB · ~1k

**C1** - Signed out resolves to `/(auth)` with `clearInvite: false`, with and without an invite (AC 1)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends a signed-out person to the auth stack"`

**C2** - Signed in with the user still loading resolves to `route: null` (AC 2)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "stays put while the user is unknown"`

**C3** - No `activeRole` resolves to `/(onboarding)/user-type` with `clearInvite: false`, with and without an invite (AC 3)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends someone with no role to the role step"`

**C4** - A manager with no academy resolves to `/(app)/create-academy` with `clearInvite: true` (AC 4)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends a manager with no academy to create one"`

**C5** - A manager with an academy resolves to `/(app)/(manager)/(home)` with `clearInvite: true` (AC 5)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends a manager with an academy home"`

**C6** - Each of `instructor`, `student` and `guardian` with no membership and no invite resolves to `/(app)/(joining)/search-academy` with `clearInvite: false` (AC 6)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends every member role with no invite to the academy search"`

**C7** - Each of `instructor`, `student` and `guardian` with no membership and an invite naming `"a1"` resolves to `/(app)/(joining)/academy/a1` with `clearInvite: false` (AC 7)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends every member role with an invite straight to that academy"`

**C8** - A `pending` membership resolves to `/(app)/(joining)/pending-approval` with `clearInvite: true`, with and without an invite (AC 8)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends a pending request to the waiting screen and spends the invite"`

**C9** - `student` with an `active` membership resolves to `/(app)/(student)/(home)` with `clearInvite: true` (AC 9)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends an active student to the student home"`

**C10** - `instructor` with an `active` membership resolves to `/(app)/(instructor)/(home)` with `clearInvite: true` (AC 10)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends an active instructor to the instructor home"`

**C11** - `guardian` with an `active` membership resolves to `/(app)/(guardian)/(home)` with `clearInvite: true` (AC 11)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends an active guardian to the guardian home"`

**C12** - An `active` membership in `"a1"` with an invite naming `"a2"` resolves to `/(app)/(joining)/already-member` with `clearInvite: true`, for all three member roles (AC 12)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "sends someone invited elsewhere to the already-a-member screen"`

**C13** - An `active` membership in `"a1"` with an invite naming `"a1"` resolves to that role's home with `clearInvite: true`, for all three member roles (AC 13)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "absorbs an invite to the academy the person already belongs to"`

**C14** - A `blocked` membership resolves to `route: null` with `clearInvite: false` (AC 14)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "leaves a blocked membership where it is today"`

**C15** - Every combination of the 4 auth/role states x 4 membership states x 3 invite states returns a `string | null` route and a boolean, and throws on none of the 48 (AC 15)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "never throws and always answers"`

**C16** - Exactly one non-test file under `apps/mobile/app` and `apps/mobile/lib` imports `@/lib/gatekeeper`, and it is `app/(app)/index.tsx` (AC 17)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/gatekeeper.test.ts -t "has exactly one importer"`

### S2 - the invite's lifetime · 4 files · 7 KB · ~2k

**C17** - `setPendingInvite` makes the invite readable from `getPendingInviteSnapshot()` before the AsyncStorage write resolves, proven with a `setItem` double that never settles (AC 18)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "is readable before the write lands"`

**C18** - `setPendingInvite({academyId:"a1",role:"instructor"})` calls `setItem` with key `tatame.pending-invite` and value `{"academyId":"a1","role":"instructor"}` (AC 19)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "mirrors the invite to one storage key"`

**C19** - In a fresh module with that key holding `{"academyId":"a1","role":"instructor"}`, `hydratePendingInvite()` makes the invite readable (AC 20)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "recovers the invite after the process restarts"`

**C20** - `clearPendingInvite()` calls `removeItem` with `tatame.pending-invite` and leaves `getPendingInviteSnapshot().invite` `null` (AC 21)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "forgets the invite in both places"`

**C21** - Each of the 7 unusable persisted values hydrates to `invite: null` without throwing: absent, `"not json"`, `"[]"`, `"\"a1\""`, `{"academyId":"","role":null}`, `{"academyId":7,"role":null}`, `{"academyId":"a1","role":"gestor"}` (AC 22)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "refuses every unusable persisted value"`

**C22** - A `getItem` that rejects leaves `getPendingInviteSnapshot().invite` `null`, marks the store hydrated, and resolves rather than rejecting (AC 23)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "survives a storage read that fails"`

**C23** - A `setItem` that rejects does not throw out of `setPendingInvite` and leaves the invite readable from module state (AC 23)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "survives a storage write that fails"`

**C24** - A second `hydratePendingInvite()` makes no second `getItem` call, asserted as a call count of 1 (AC 24)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "reads storage once"`

**C25** - A subscriber is notified on `setPendingInvite` and on `clearPendingInvite`, and one that has unsubscribed is notified on neither, asserted as call counts of 2 and 0 (AC 25)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "notifies the subscribers it still has"`

**C26** - Two `getPendingInviteSnapshot()` calls with no intervening write return the identical object, asserted with `toBe` (AC 26)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "returns a stable snapshot"`

**C27** - TAT-177's three store behaviours still hold under persistence: nothing before an invite arrives, last write wins, nothing after a clear
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "holds nothing before an invite arrives"`
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "keeps the most recent invite"`
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "forgets the invite when cleared"`

**C28** - `redirectSystemPath` still returns `/` for an invite, `/` for `/baixar` and the input byte for byte for anything else, with the persisted store behind it - TAT-177's six tests unchanged except for the AsyncStorage double
Proof: `pnpm --filter @tatame/mobile exec vitest run "app/+native-intent.test.ts"`

### S3 - the invite's context on the role step · 4 files · 11 KB · ~3k

**C29** - Role `"instructor"` with academy `"Alliance Centro"` produces `"Você foi convidado para ser Instrutor na Alliance Centro"` (AC 27)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-copy.test.ts -t "names the role and the academy"`

**C30** - Role `"instructor"` with `null` academy produces `"Você foi convidado para ser Instrutor nesta academia"`, containing neither `"null"` nor `"undefined"` (AC 28)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-copy.test.ts -t "names the role when the academy has no name yet"`

**C31** - `null` role with academy `"Alliance Centro"` produces `"Você foi convidado para entrar na Alliance Centro"` (AC 29)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-copy.test.ts -t "names the academy when the link suggested no role"`

**C32** - `null` role with `null` academy produces `"Você foi convidado para entrar nesta academia"`, containing neither `"null"` nor `"undefined"` (AC 30)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-copy.test.ts -t "names neither when the link gave neither"`

**C33** - A suggested role produces `"Você pode escolher outro perfil se preferir."` and no suggested role produces `"Selecione o seu perfil para continuar."` (AC 31)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-copy.test.ts -t "says the suggestion can be changed"`

**C34** - `ROLE_LABELS` maps `student`, `instructor` and `guardian` to `"Aluno"`, `"Instrutor"` and `"Responsável"`, and `app/(onboarding)/user-type.tsx` reads that table instead of carrying any of the three literals (AC 32)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-copy.test.ts -t "labels the three roles once"`
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-copy.test.ts -t "is the only place the role step gets its labels"`

### S4 - every dead end becomes a sentence in Brazilian Portuguese · 3 files · 7 KB · ~2k

**C35** - An `ApiError` with status `403` produces `"Você não pode solicitar entrada nesta academia novamente até que um gestor libere seu acesso."` (AC 36)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/membership-errors.test.ts -t "explains a blocked or rejected academy"`

**C36** - An `ApiError` with status `409` and `hasMembership: true` produces `"Você já faz parte de uma academia. Saia da atual antes de entrar em outra."` (AC 37)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/membership-errors.test.ts -t "tells a member of another academy to leave it first"`

**C37** - An `ApiError` with status `409` and `hasMembership: false` produces `"Você já tem uma solicitação pendente nesta academia."` (AC 38)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/membership-errors.test.ts -t "tells someone their request is already in"`

**C38** - An `ApiError` with status `404` and one with status `400` both produce `"Academia não encontrada. Peça um link de convite novo ao gestor."` (AC 39)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/membership-errors.test.ts -t "treats an unknown academy and a malformed id the same way"`

**C39** - A plain `Error`, a string and an `ApiError` with status `500` all produce `"Não foi possível enviar sua solicitação. Tente novamente."` (AC 40)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/membership-errors.test.ts -t "falls back when it does not recognise the failure"`

**C40** - For the academy load, an `ApiError` with status `404` and one with status `400` both produce `"Academia não encontrada. O link de convite pode estar inválido."` (AC 41)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/membership-errors.test.ts -t "says an invite link points nowhere"`

**C41** - For the academy load, an `ApiError` with status `500` and a plain `Error` both produce `"Não foi possível carregar a academia. Verifique sua conexão e tente novamente."` (AC 42)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/membership-errors.test.ts -t "blames the connection when it does not know"`

**C42** - Each of the 7 sentences contains at least one accented Brazilian Portuguese character, and none contains any substring of the English `HttpError` message the API sent in the same `ApiError` (AC 43)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/membership-errors.test.ts -t "never leaks the API sentence"`

**C43** - `app/(app)/(joining)/academy/[academyId].tsx` contains no `(joining)/pending-approval` destination, so both response statuses leave by `/(app)` (AC 44)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/membership-errors.test.ts -t "leaves the destination to the gatekeeper"`

### S5 - what must not move · 0 new files · ~0k

**C44** - `app/(app)/(guardian)/(home)/index.tsx` is byte-identical to the feature base, so the redirect to `register-dependent` is untouched (AC 45)
Proof: `git diff --quiet origin/jeremiassnts3/tat-175-let-managers-invite-new-members-with-a-shareable-smart -- "apps/mobile/app/(app)/(guardian)/(home)/index.tsx"`

**C45** - The whole repository's suite, lint and typecheck stay green, with the mobile count at 27 plus this feature's additions (AC 46)
Proof: `pnpm test`
Proof: `pnpm lint`
Proof: `pnpm typecheck`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| gatekeeper decision table (14 rows) | signed out C1 · user loading C2 · no role C3 · manager no academy C4 · manager with academy C5 · member no membership no invite C6 · member no membership with invite C7 · pending C8 · active student C9 · active instructor C10 · active guardian C11 · active elsewhere + invite C12 · active here + invite C13 · blocked C14 | - |
| member roles reaching the join path (3) | `instructor` C6 C7 · `student` C6 C7 · `guardian` C6 C7 | - |
| active-membership home routes (3) | `student` C9 · `instructor` C10 · `guardian` C11 | - |
| invite academy vs membership academy (2) | different C12 · same C13 | - |
| `clearInvite` per route-table row (14) | signed out `false` C1 · user loading `false` C2 · no role `false` C3 · manager no academy `true` C4 · manager with academy `true` C5 · member no invite `false` C6 · member with invite `false` C7 · pending `true` C8 · active student `true` C9 · active instructor `true` C10 · active guardian `true` C11 · active elsewhere `true` C12 · active same academy `true` C13 · blocked `false` C14 | - |
| unusable persisted values (7) | C21, table-driven over all 7 | - |
| store transitions (4) | empty C27 · written C17 · overwritten C27 · cleared C20 | - |
| storage failure surfaces (2) | `getItem` rejects C22 · `setItem` rejects C23 | - |
| subscriber notification (3) | on set C25 · on clear C25 · after unsubscribe C25 | - |
| hydration call count (2) | first call reads C19 · second call does not C24 | - |
| headline variants (4) | role + name C29 · role only C30 · name only C31 · neither C32 | - |
| role hint sentences (2) | suggested C33 · none C33 | - |
| role labels (3) | `student` C34 · `instructor` C34 · `guardian` C34 | - |
| membership-request failure classes (6) | 403 C35 · 409 with membership C36 · 409 without C37 · 404 C38 · 400 C38 · unrecognised C39 | - |
| academy-load failure classes (3) | 404 C40 · 400 C40 · unrecognised C41 | - |
| Brazilian Portuguese sentences (7) | C42, table-driven over all 7 | - |
| AsyncStorage double, test assemblies (2) | `lib/pending-invite.test.ts` C17-C27 · `app/+native-intent.test.ts` C28 | - |
| `+native-intent` outcomes still intact (3) | invite C28 · `/baixar` C28 · pass-through C28 | - |

- The plan's `Surface` is `None - nothing consumed outside`, so no route owes a status row. The two
  routes this feature calls, `GET /academies/:academyId/public` and `POST /memberships/requests`,
  are consumed unchanged; what this feature decides about them is the failure-class rows above,
  not their statuses
- `Relations` is `None - no stored-data shape change`, so no entity owes a check. Door 1's persisted
  shape is the one stored thing and it is covered by C18, C19 and C21
- Every one-way door has a check: door 1 C18/C19/C21, door 2 C16, door 3 manual M1, door 4 manual M4,
  door 5 the `clearInvite` row
- No startup configuration changes. Nothing has to be true before the first render that is not true
  today; the one assembly-shaped set is the AsyncStorage double, and it has its row
- Claims naming a status code: C35-C41, each proven by constructing the `ApiError` the mobile client
  builds from that status, which is the boundary the sentence is chosen at
- No other check claims more than the cases its proof exercises

## Test policy

`AGENTS.md` on this branch still has no `### Test policy` section, and the maintainer settled in
TAT-177 that these rows stay per-feature rather than being written into it. So they are proposed
here and not asked about again. Neither of the two questions - which level proves a given shape of
code, and how much of its input space a proof must assert - is answered anywhere in the repository
for `apps/mobile`. `apps/mobile/vitest.config.ts` answers a third, different question: where tests
run and why no renderer is configured.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, in a pure module with no platform import | one at its own layer | one asserted case per row of the decision table, every rejected input named as its own member |
| Decides, behind a platform module the node harness cannot load | one at its own layer with that module doubled | one case per decision row, plus one per failure mode of the doubled module |
| Module-scoped mutable state with a persisted mirror | one per transition, and one per place the value can be read from | empty, written, overwritten, cleared, recovered after a restart, and both storage calls failing |
| A screen in a package with no renderer | none at its own layer; every decision it would make moves into a pure module that gets one | the pure module carries the coverage; the wiring carries a named manual pass with its expected observation |
| Instrumentation - a re-export, a hook forwarding to a store, a `useQuery` wrapper, a `fetch` wrapper | none of its own | covered by its consumer's proof |

Evidence:

- `apps/mobile/lib/gatekeeper.ts`: dispatches over 14 rows - 4 auth/role states, then manager with
  and without an academy, then 4 membership states crossed with whether an invite names the same
  academy - 19 branch points -> decides
- `apps/mobile/lib/pending-invite.ts`: was 3 functions over one `let` with no conditional, which is
  why TAT-177 classified it as instrumentation by shape. It now carries a 7-class validator, a
  hydration guard, a subscriber set and two swallowed rejections, 13 branch points -> decides, and
  row 3 governs it
- `apps/mobile/lib/invite-copy.ts`: a 4-variant headline, a 2-variant hint and a 3-row label table,
  6 branch points -> decides
- `apps/mobile/lib/membership-errors.ts`: two dispatches, 6 classes and 3 classes, where the 409
  split turns on a second argument rather than on the status, 10 branch points -> decides
- `apps/mobile/lib/hooks/use-pending-invite.ts`: forwards three store functions into
  `useSyncExternalStore` and kicks hydration in an effect, no conditional deciding a result ->
  instrumentation, covered by C17-C27
- `apps/mobile/lib/api.ts#getPublicAcademy` and `lib/hooks/use-academy.ts#usePublicAcademy`: a
  `request` call and a `useQuery` wrapper, no conditional -> instrumentation
- `app/(app)/index.tsx`, `app/(onboarding)/user-type.tsx`,
  `app/(app)/(joining)/academy/[academyId].tsx`, `app/(app)/(joining)/already-member.tsx`: row 4.
  Each one's decision has been moved out - the route to `lib/gatekeeper.ts`, the headline to
  `lib/invite-copy.ts`, the sentence to `lib/membership-errors.ts` - and what is left is wiring
  with a manual pass named below
- closest analogue in the repo: `apps/mobile/lib/invite-link.ts` (TAT-177), a 4-class URL dispatch
  proven at its own layer with one asserted case per class and every rejected input named. For row
  3, the same ticket's `lib/pending-invite.test.ts`, one test per transition. For row 2,
  `apps/web/lib/invite.ts#resolveInviteView` (TAT-176), a 3-outcome dispatch proven with `fetch`
  doubled rather than with a live API

Cost: 4 proofs at their own layer across 4 modules, 3 of them new, plus the AsyncStorage double in
2 test files. Without these rows the 14-row route table, the 7-class validator, the 4-variant
headline and the 9-class error dispatch are each proven only by whichever path a happy-path call
traverses, and one call traverses exactly one row of each.

## Swept

- validation: C21 - the 7 classes of unusable persisted value, each its own member
- failure modes: C22, C23 - a storage read and a storage write that reject; C39, C41 - a failure
  the dispatch does not recognise still produces a sentence
- idempotency: C24 - a second hydrate makes no second read; C13 - an invite to the academy the
  person already belongs to is absorbed rather than re-requested; C37 - a second request for the
  same academy answers 409 and says so in Portuguese
- authorization: existing - `POST /memberships/requests` keeps
  `authorize(Role.Instructor, Role.Student, Role.Guardian)` and takes the role from
  `req.appAuth!.role`, and `GET /academies/:academyId` keeps `requireSession`. This feature adds no
  route and changes no guard, which is why the role step cannot be skipped
- concurrency: C17 - the write to AsyncStorage and the gatekeeper's read are not ordered by
  anything, so module state is the synchronous truth and the invite is readable before the write
  resolves. Proven with a `setItem` double that never settles
- data lifecycle: the `clearInvite` row of `Coverage` - C4, C5, C8, C9-C13 spend the invite and
  C1, C2, C3, C6, C7, C14 keep it; C20 - clearing removes the key as well as the value. No TTL, by
  door 5
- dependency failure: C30 - the public academy lookup failing degrades the headline to its no-name
  variant and leaves the role step usable; C41 - the authenticated academy lookup failing produces
  a sentence and a retry rather than a spinner
- state transitions: C1-C14 - the route table is the state machine; C27 - the store's four
  transitions, with C19 adding the recovery after a restart
- observability: n/a - `apps/mobile` has no telemetry sink and no logger. `lib/notifications.ts`
  swallows its own failures with a bare comment, and there is no `console.*` convention to follow
  here. The API side is untouched, so no event in the typed catalogue applies, and the invite's
  effect is observable as the screen the person lands on

## Manual

Eight criteria have no automated proof, because `apps/mobile` has no renderer and the maintainer
chose to test the wiring by hand. Roteiro em português, porque quem executa é o mantenedor.
Rodar no Expo Go, no celular Android, com a API local.

Gerar o link: `npx uri-scheme open "exp://<ip>:8081/--/convite/<academyId>?papel=instrutor" --android`
ou colar a URL no navegador do celular. O `academyId` é o uuid de uma academia que exista no banco.

| # | AC | O que fazer | O que tem que acontecer |
| --- | --- | --- | --- |
| M1 | 16 | Com o app aberto e já na tela de busca de academia, abrir o link de convite | A tela troca **uma vez** para a academia do convite. Nenhum pisca-pisca, nenhuma volta para a busca |
| M2 | 33 | Deslogado, abrir o link com `?papel=instrutor` e criar uma conta nova | A tela de perfil abre com **Instrutor** já marcado e com o cabeçalho nomeando a academia |
| M3 | 34 | Na mesma tela, tocar em **Aluno** e esperar o nome da academia terminar de carregar | **Aluno** continua marcado. O cabeçalho não volta para Instrutor |
| M4 | 35, 44 | Continuar com **Aluno** marcado, pedir entrada e aprovar no painel do gestor | O pedido entra como **aluno**, não como instrutor, e o app termina na home de aluno |
| M5 | 41 | Abrir `exp://<ip>:8081/--/convite/00000000-0000-0000-0000-000000000000` com um usuário que já tem papel | A tela mostra "Academia não encontrada. O link de convite pode estar inválido." e um caminho de volta — não o spinner infinito de hoje |
| M6 | 42 | Derrubar a API e abrir um link de convite válido com um usuário que já tem papel | A tela mostra "Não foi possível carregar a academia. Verifique sua conexão e tente novamente." com um botão de tentar de novo |
| M7 | 43 | Repetir M5 e M6 e ler as duas telas inteiras | Nenhuma frase em inglês. Nenhum texto vindo do `HttpError` da API |
| M8 | 45 | Abrir o link com `?papel=responsavel`, criar conta, pedir entrada, aprovar no painel, voltar ao app | O app termina em **cadastrar dependente**, não numa home vazia |
| M9 | 12 | Com uma conta que já é membro ativo da academia A, abrir um convite da academia B | Tela amigável dizendo que já faz parte de uma academia e que precisa sair antes de entrar em outra. Depois de sair dela, o app vai para a home — o convite não volta |
| M10 | - | Matar o app pelo gerenciador de tarefas depois de abrir o convite e antes de criar a conta, e então abrir o app pelo ícone | O convite continua valendo: o fluxo termina na academia do convite, sem busca por nome |

M10 não está em nenhum AC e é o que a porta 1 existe para garantir. Vale rodar.

## Handoff

- S1 = 1k · S2 = 3k · S3 = 6k · S4 = 8k · S5 = 8k running total, against a 150k budget
- Arithmetic: 32 KB of existing files to read (`wc -c` over the 11 files this feature touches) plus
  roughly 12 KB written, 44 KB total, divided by four
- **One builder.** The estimate is 8k against 150k, so there is nothing to cut and no mechanism to
  choose
