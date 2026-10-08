# TAT-176 — Public invite page, download page and public academy endpoint — checks

Profile: standard
Plan: `.specs/features/tat-176-public-invite-page/plan.md`

33 checks in 5 slices · 4 one-way doors · 1 open, of which 0 block

Every proof runs from the repository root. `pnpm install` first; the workspace packages must be
built (`pnpm build`) before the API integration project, because `@tatame/config` and
`@tatame/db` resolve through `dist/`, and that project starts its own Postgres through
testcontainers, so Docker has to be up.

Three proof mechanics were spiked before being written down, rather than assumed:

- `pnpm --filter @tatame/web exec vitest run <file> -t "<name>"` runs with
  `environment: "node"` and `esbuild.jsx: "automatic"`. Without the esbuild line a `.tsx` test
  fails with `React is not defined`.
- `renderToStaticMarkup(await Page(props))` renders an awaited async server component tree to an
  HTML string with no DOM, and `notFound()` surfaces as a rejection — both confirmed green.
- A route handler under `app/.well-known/` builds and reaches
  `.next/app-path-routes-manifest.json` as `/.well-known/apple-app-site-association` and
  `/.well-known/assetlinks.json`. The leading dot and the `.json` segment are both fine; the
  manifest is what C31 reads.

## Checks

### S1 — An unauthenticated caller can read an academy's name and logo · 7 files · 27 KB · ~7k

**C1** - `GET /v1/academies/:academyId/public` for a seeded academy answers `200` with `name` equal to the seeded name and `logoUrl` equal to the seeded logo URL (AC 1)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/academy-membership.integration.test.ts -t "serves an academy's name and logo with no session"`

**C2** - The `200` body's key list, compared by array equality against `["id", "name", "logoUrl"]`, is exactly that — so a removed key and an added key both fail (AC 1, AC 4)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/academy-membership.integration.test.ts -t "exposes nothing beyond id, name and logoUrl"`

**C3** - `GET /v1/academies/not-a-uuid/public` answers `400` with `error: "Invalid academy id"` (AC 2)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/academy-membership.integration.test.ts -t "refuses an academy id that is not a uuid"`

**C4** - `GET /v1/academies/<unseeded uuid>/public` answers `404` with `error: "Academy not found"` (AC 3)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/academy-membership.integration.test.ts -t "answers not found for an academy id nobody owns"`

**C5** - With `getAuth` returning no `userId`, `GET /v1/academies/:academyId/public` answers `200` while `GET /v1/academies/:academyId` on the same router answers `401` in the same test (AC 1)
Proof: `pnpm --filter @tatame/api exec vitest run --project integration src/academy-membership.integration.test.ts -t "opens only the public projection to an anonymous caller"`

**C6** - `AcademyService.getPublicById` returns `null` for an id the repository does not hold, and `{ id, name, logoUrl }` for one it does (AC 1, AC 3)
Proof: `pnpm --filter @tatame/api exec vitest run --project unit src/modules/academy/academy.service.test.ts -t "projects only the public fields of an academy"`
Proof: `pnpm --filter @tatame/api exec vitest run --project unit src/modules/academy/academy.service.test.ts -t "returns null for an academy that does not exist"`

### S2 — One definition of the store buttons, used everywhere · 6 files · 20 KB · ~5k

**C7** - `detectPlatform` returns `"ios"` for an iPhone, an iPad and an iPod user-agent string (AC 6)
Proof: `pnpm --filter @tatame/web exec vitest run lib/store-links.test.ts -t "reads iPhone, iPad and iPod as iOS"`

**C8** - `detectPlatform` returns `"android"` for an Android user-agent string (AC 7)
Proof: `pnpm --filter @tatame/web exec vitest run lib/store-links.test.ts -t "reads an Android user-agent as Android"`

**C9** - `detectPlatform` returns `null` for a desktop macOS user-agent, a Windows user-agent, an empty string and `undefined` (AC 8)
Proof: `pnpm --filter @tatame/web exec vitest run lib/store-links.test.ts -t "highlights nothing when the platform is neither"`

**C10** - `StoreButtons` renders an `href` of `https://ios.apptatame.com.br` and an `href` of `https://android.apptatame.com.br` under each of `highlight="ios"`, `highlight="android"` and `highlight={null}` — table-driven over all 3 (AC 5)
Proof: `pnpm --filter @tatame/web exec vitest run components/store-buttons.test.tsx -t "renders both store links whatever the platform"`

**C11** - `highlight="ios"` marks the App Store link and not the Google Play link; `highlight="android"` marks the Google Play link and not the App Store link; `highlight={null}` marks neither — table-driven over all 3 (AC 6, AC 7, AC 8)
Proof: `pnpm --filter @tatame/web exec vitest run components/store-buttons.test.tsx -t "marks exactly the store matching the platform"`

**C12** - Exactly one file under `apps/web` contains the string `ios.apptatame.com.br`, and exactly one contains `android.apptatame.com.br` (AC 9)
Proof: `bash -c '[ "$(git grep -l ios.apptatame.com.br -- apps/web | wc -l | tr -d " ")" = 1 ] && [ "$(git grep -l android.apptatame.com.br -- apps/web | wc -l | tr -d " ")" = 1 ]'`

**C13** - Each of `app/assinatura-confirmada/page.tsx`, `app/conta/(dashboard)/layout.tsx`, `app/baixar/page.tsx` and `app/convite/[academyId]/page.tsx` imports `StoreButtons` — 4 members, each asserted by name (AC 10)
Proof: `pnpm --filter @tatame/web exec vitest run components/store-buttons.test.tsx -t "is the only store markup every consumer renders"`

### S3 — A member-facing download page · 2 files · 4 KB · ~1k

**C14** - `await BaixarPage()` renders markup containing both store `href`s (AC 11)
Proof: `pnpm --filter @tatame/web exec vitest run app/baixar/page.test.tsx -t "puts both stores in front of a member"`

**C15** - The rendered `/baixar` markup contains none of the marketing copy that identifies `HeroV2`, `FeaturesV2`, `PricingV2` or `FaqV2` — 4 members, each a string asserted absent (AC 12)
Proof: `pnpm --filter @tatame/web exec vitest run app/baixar/page.test.tsx -t "carries no manager marketing"`

### S4 — An invite link that names the academy and the kind of member · 7 files · 20 KB · ~5k

**C16** - `resolveInviteView` given a found academy returns a view whose `academyName` is that academy's name (AC 13)
Proof: `pnpm --filter @tatame/web exec vitest run lib/invite.test.ts -t "names the academy that invited"`

**C17** - `resolveInviteRole` returns `"student"` for `aluno`, `"instructor"` for `instrutor` and `"guardian"` for `responsavel` — table-driven over all 3 (AC 16)
Proof: `pnpm --filter @tatame/web exec vitest run lib/invite.test.ts -t "maps each papel token to its role"`

**C18** - `resolveInviteRole` returns `null` for `undefined`, `""`, `"xyz"`, `"ALUNO"` and a 64-character string — 5 members, each asserted (AC 17)
Proof: `pnpm --filter @tatame/web exec vitest run lib/invite.test.ts -t "degrades an unknown papel to no suggested role"`

**C19** - `resolveInviteView` returns `kind: "not-found"` for a `400` and for a `404` from the public endpoint, `kind: "unavailable"` for a thrown fetch and for a `500`, and `kind: "ok"` for a `200` — 5 members over the two axes (AC 19, AC 20)
Proof: `pnpm --filter @tatame/web exec vitest run lib/invite.test.ts -t "turns each endpoint outcome into its own view"`

**C20** - `await ConvitePage({ params, searchParams })` for a found academy renders that academy's `name` in the markup (AC 13)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/convite/[academyId]/page.test.tsx' -t "renders the inviting academy's name"`

**C21** - With `logoUrl` non-null the page renders an `img` whose `src` is that URL; with `logoUrl` null it renders an `img` whose `src` is `/icon.png` — 2 members (AC 14, AC 15)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/convite/[academyId]/page.test.tsx' -t "falls back to the Tatame icon when the academy has no logo"`

**C22** - `?papel=aluno` renders `Aluno` in the heading, `?papel=instrutor` renders `Instrutor`, `?papel=responsavel` renders `Responsável` — table-driven over all 3, asserting the accented form (AC 16)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/convite/[academyId]/page.test.tsx' -t "names the kind of member in the heading"`

**C23** - With `papel` absent and with `papel=xyz` the heading contains none of `Aluno`, `Instrutor` or `Responsável` and the page still resolves — 2 members (AC 17)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/convite/[academyId]/page.test.tsx' -t "says nothing about the role when papel is unusable"`

**C24** - The page renders the sentence `Já instalou? Toque neste link de novo para entrar direto na academia.` under the found, the generic and the unavailable outcomes — 3 members (AC 18)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/convite/[academyId]/page.test.tsx' -t "closes the loop with the re-tap sentence"`

**C25** - A `400` and a `404` from the public endpoint make the page reject with Next's `notFound()` digest, and `convite/[academyId]/not-found.tsx` renders the invalid-link copy carrying no academy name — 2 members plus the body (AC 19)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/convite/[academyId]/page.test.tsx' -t "sends an unknown academy to the invalid-link page"`
Proof: `pnpm --filter @tatame/web exec vitest run 'app/convite/[academyId]/not-found.test.tsx' -t "tells the visitor the invite link is invalid"`

**C26** - A thrown fetch and a `500` both resolve the page, rendering no academy name while still rendering both store `href`s and the re-tap sentence — 2 members (AC 20)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/convite/[academyId]/page.test.tsx' -t "still offers the app when the academy cannot be loaded"`

**C27** - The rendered markup of the found, generic, and unavailable outcomes contains none of `uso único`, `link único`, `exclusivo`, `pessoal`, `válido apenas para` — 5 strings × 3 outcomes, table-driven (AC 21)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/convite/[academyId]/page.test.tsx' -t "never implies the link belongs to one person"`

### S5 — The domain association files TAT-177 consumes · 7 files · 13 KB · ~3k

**C28** - With `IOS_APP_ID=ABCDE12345.com.anonymous.tatame`, `GET()` answers `200`, `content-type: application/json`, and `applinks.details[0].appIDs` equal to `["ABCDE12345.com.anonymous.tatame"]` (AC 22)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/.well-known/apple-app-site-association/route.test.ts' -t "declares the iOS app for the invite paths"`

**C29** - `applinks.details[0].components` carries an entry matching `/convite/*` and an entry matching `/baixar` — 2 members (AC 23)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/.well-known/apple-app-site-association/route.test.ts' -t "lists both invite paths in components"`

**C30** - With `IOS_APP_ID` unset, `GET()` answers `404` (AC 24)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/.well-known/apple-app-site-association/route.test.ts' -t "answers 404 while the app id is unconfigured"`

**C31** - With `ANDROID_SHA256_CERT_FINGERPRINTS` holding two comma-separated fingerprints, `GET()` answers `200`, `content-type: application/json`, and a single statement whose `relation` equals `["delegate_permission/common.handle_all_urls"]`, whose `target.package_name` equals `com.anonymous.tatame`, and whose `target.sha256_cert_fingerprints` equals both fingerprints in order (AC 25)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/.well-known/assetlinks.json/route.test.ts' -t "delegates both signing certificates to the Android package"`

**C32** - With `ANDROID_SHA256_CERT_FINGERPRINTS` unset, `GET()` answers `404` (AC 26)
Proof: `pnpm --filter @tatame/web exec vitest run 'app/.well-known/assetlinks.json/route.test.ts' -t "answers 404 while the fingerprints are unconfigured"`

**C33** - After a real `next build`, `.next/app-path-routes-manifest.json` holds `/.well-known/apple-app-site-association` with no file extension, `/.well-known/assetlinks.json`, `/baixar` and `/convite/[academyId]`, and still holds the live sibling `/assinatura-confirmada` (AC 11, AC 13, AC 27)
Proof: `bash -c 'pnpm --filter @tatame/web build >/dev/null && node scripts/assert-web-routes.mjs'`

**C34** - `isProtectedRoute` is `false` for `/convite/<uuid>`, `/baixar`, `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`, and `true` for the live sibling `/conta/assinatura` in the same test — 5 members (AC 28)
Proof: `pnpm --filter @tatame/web exec vitest run middleware.test.ts -t "challenges only the manager account area"`

**C35** - `config.matcher[0]` as a regex **does** match `/.well-known/assetlinks.json`, so the pass-through is carried by `isProtectedRoute` rather than by the matcher — the claim in TAT-176's description, asserted false (AC 28)
Proof: `pnpm --filter @tatame/web exec vitest run middleware.test.ts -t "does run the middleware on assetlinks.json"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /v1/academies/:academyId/public` statuses (3) | `200` C1 · `400` C3 · `404` C4 | - |
| `GET /convite/<academyId>` statuses (2) | `200` C20, C26 · `404` C25 | - |
| `GET /baixar` statuses (1) | `200` C14 | - |
| `GET /.well-known/apple-app-site-association` statuses (2) | `200` C28 · `404` C30 | - |
| `GET /.well-known/assetlinks.json` statuses (2) | `200` C31 · `404` C32 | - |
| academy fields withheld from the public body (9) | `ownerId` C2 · `pixKey` C2 · `pixKeyType` C2 · `address` C2 · `contactEmail` C2 · `contactPhone` C2 · `foundedAt` C2 · `createdAt` C2 · `updatedAt` C2 — one array equality over the whole key list, so any one of the nine appearing fails it | - |
| `papel` token vocabulary (4 classes) | `aluno` C17, C22 · `instrutor` C17, C22 · `responsavel` C17, C22 · anything else C18, C23 | - |
| `papel` unusable inputs (5) | `undefined` C18 · `""` C18 · `"xyz"` C18 · `"ALUNO"` C18 · 64 chars C18 | - |
| public-endpoint outcome -> page view (5) | `200` C19, C20 · `400` C19, C25 · `404` C19, C25 · `500` C19, C26 · thrown fetch C19, C26 | - |
| user-agent platform classes (4) | iPhone/iPad/iPod C7 · Android C8 · desktop C9 · absent C9 | - |
| `StoreButtons` highlight states (3) | `"ios"` C10, C11 · `"android"` C10, C11 · `null` C10, C11 | - |
| `logoUrl` presence (2) | non-null C21 · null C21 | - |
| `StoreButtons` consumers (4) | `assinatura-confirmada` C13 · `conta/(dashboard)/layout` C13 · `/baixar` C13, C14 · `/convite/[academyId]` C13, C26 | - |
| copy forbidden on `/convite`, 5 strings × 3 outcomes (15) | C27, table-driven over all 15 pairs — the enumeration lives in the test's own fixture arrays | - |
| marketing components barred from `/baixar` (4) | `HeroV2` C15 · `FeaturesV2` C15 · `PricingV2` C15 · `FaqV2` C15 | - |
| one-way doors (4) | door 1 C5, C2 · door 2 C7-C11, C14-C32 (every web proof exists only because the runner does) · door 3 C17, C18 · door 4 C28, C30, C31, C32 | - |
| `.well-known` env vars, absent (2) | `IOS_APP_ID` C30 · `ANDROID_SHA256_CERT_FINGERPRINTS` C32 | - |
| middleware paths that must not be challenged (5) | `/convite/<uuid>` C34 · `/baixar` C34 · AASA C34 · `assetlinks.json` C34 · sibling `/conta/assinatura` C34 | - |
| startup config: Next route registration (2 assemblies) | real `next build` manifest C33 · vitest calling the component or handler directly C14, C20, C28, C31 | - |
| startup config: the public academy route is mounted (1 assembly) | `createApp()` C1-C5 — collapsed deliberately: `server.ts` and the integration harness both build the app through the same `createApp()`, so there is one assembly, not two | - |

- `validate_checks.py` warns that C12's proof names no test selector. It is a one-shot
  `git grep -l … | wc -l` equality against `1`, not a suite: it settles C12 and nothing else, and
  it fails the moment a second file under `apps/web` names either store URL. Left as a command on
  purpose — the claim is about the repository's file set, which no test running inside the bundle
  can see.
- Claims naming a status code, route or response shape: C1-C5, C25, C28, C30, C31, C32, C33 — each has a proof that crosses the boundary it claims (supertest through the assembled Express app for C1-C5; the route handler's own `Response` for C28-C32; a real `next build` manifest for C33)
- C19 proves the fetch-outcome table at its own layer; C20, C25 and C26 prove the page's three rendered outcomes. Neither stands in for the other
- No other check claims more than the single case its proof exercises

## Test policy

`AGENTS.md` on `dev` says nothing about testing. The branch for TAT-187 adds a `### Test policy`
section with two rows — **"decides, and reachable only through SQL"** and **"entry point that
decides nothing — a route's existence"** — and those are adopted here as written rather than
restated. Neither reaches `apps/web`, which has no test runner at all on `dev`, so the two
questions are open for every layer this feature adds. The rows below answer them, and
`docs/superpowers/specs/2026-03-20-api-testing-design.md` does not: it settles where tests live
and how they are built.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, in a module reachable without a request | one at its own layer | one asserted case per row of the decision table |
| Decides, inside a route handler returning a `Response` | one calling the exported `GET` directly | one case per branch, asserting status, `content-type` and body together — a `200` with the wrong body is the failure mode |
| A server component composing a decided view model into markup | one rendering `await Page(props)` through `react-dom/server` | one case per distinct rendered outcome, asserting the text the reader sees, not the element shape |
| An app-router route's existence | one over `.next/app-path-routes-manifest.json` from a real `next build` | every path under claim, plus a live sibling produced by the same build |
| Instrumentation — presentational markup with no conditional | none of its own | covered by its consumer's proof |

Evidence:

- `apps/web/lib/invite.ts`: two independent decisions, not one 12-row table — `resolveInviteRole`
  dispatches over 4 token classes, and `resolveInviteView` over 5 endpoint outcomes. 9 branch
  points -> decides
- `apps/web/lib/store-links.ts#detectPlatform`: dispatches over 4 user-agent classes, 4 branch
  points -> decides
- `apps/web/components/store-buttons.tsx`: one conditional per button on `highlight`, 2 branch
  points -> decides. Thin, and it still decides which store a visitor's eye lands on
- `apps/web/app/.well-known/*/route.ts` (2 files): one env-presence branch each, 2 branch points
  -> decides
- `apps/web/app/baixar/page.tsx`: no conditional, forwards nothing -> instrumentation, covered by
  C14 and C15 as its consumer's proof
- `apps/api/src/modules/academy/academy.service.ts#getPublicById`: one null branch and a
  projection of 3 of the row's 12 columns, 1 branch point -> decides
- closest analogue in the repo for the service row: `payment.pix-charge.test.ts`, a service method
  with a null branch and a projection, already proven at its own layer with one case per branch.
  For the route-existence row: `api.smoke.test.ts`, which is the TAT-187 `AGENTS.md` row verbatim

Cost: 6 proofs at their own layer across 6 files in `apps/web`, a package that has none today, plus
the vitest runner itself (door 2). Without these rows, the 4-class `papel` table, the 5-outcome
endpoint table and the 4-class user-agent table are each proven only by whichever path a page
render happens to traverse — and a page render traverses exactly one.

**One narrow ask:** do rows 2-5 go into `AGENTS.md`'s `### Test policy` alongside the two TAT-187
adds? They are the first answer this repo has for `apps/web`, so they reach every future agent
touching it. Building under them needs no permission and is what happens either way; approved rows
land in their own commit before the build.

## Swept

- validation: C3 (a non-uuid academy id), C18 (an unusable `papel`, including a 64-character one)
- failure modes: C19, C25, C26 — the `400`/`404` split from the unreachable/`5xx` split, because the
  first means "this academy does not exist" and the second means "we do not know", and collapsing
  them would tell a visitor their academy is gone during an API outage
- idempotency: n/a - every route here is a `GET` with no write; nothing to deduplicate and no
  delivery to retry
- authorization: C5 — the one route that deliberately has none, proven against a live sibling that
  still answers `401`. Everything else on the academy router keeps the guard it has
- concurrency: n/a - no shared mutable state is touched. The one read is a single-row
  `findById`, and two simultaneous invite visitors cannot observe each other
- data lifecycle: n/a - no row is created, updated or deleted, and no schema changes
- dependency failure: C26 — the API unreachable or `5xx` still renders the store buttons, so the
  visitor's actual goal survives the outage. The association files have no dependency beyond their
  env var, covered by C30 and C32
- state transitions: n/a - nothing here has a state machine. The `papel` token is a suggestion
  read off a URL, never persisted, so it has no transitions to guard
- observability: n/a - no logging, metric or span requirement in this slice. The API route reaches
  the existing HTTP server span through `app.ts`, and the typed event catalog gains nothing from a
  public read that cannot fail in a way the span does not already carry

## Handoff

Existing files the slices touch: 53 KB measured with `wc -c` across S1's 7 and S2/S5's 5, plus
roughly 25 KB of new files — 78 KB / 4 ≈ **~21k tokens**.

- S1 = 7k, all in the academy module and its tests; S2 enters `apps/web` at 12k; S3 at 13k; S4 at
  18k; S5 closes at 21k, under the 150k budget — **one builder, no handoff**
- No slice alone exceeds the budget, and the only surface boundary (API -> web, after S1) sits at
  7k, far from a cut being needed

**Open, not blocking:** the Apple Team ID and the Android SHA-256 fingerprints. S5 is built and
proven against env vars with the `404`-when-unset branch (C30, C32); the maintainer fills the real
values in the deployment environment, and `.env.example` documents both. Until then TAT-177's
universal links fall back to the browser — recorded as `blocks go-live` in the plan.
