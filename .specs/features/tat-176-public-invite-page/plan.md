# TAT-176 — Public invite page, download page and public academy endpoint

## Problem

A person who hears about Tatame from their academy has no path in except discovering the app
alone: install it from a store, sign up, pick a role in `(onboarding)/user-type`, then find the
academy by typing its name into `(joining)/search-academy`. The name search is the weakest
link — they have to guess the exact name the manager typed.

The only web address anyone can share today is `apptatame.com.br`, and that page is manager
marketing: `apps/web/app/(site)/page.tsx` composes `HeroV2`, `FeaturesV2`, `HowToStart`,
`PricingV2`, `FaqV2`. A student who opens the link a manager sent reads subscription pricing
for a product they are not buying.

Both store short links already exist — `https://ios.apptatame.com.br` and
`https://android.apptatame.com.br` — and the markup for them is copied in two places
(`assinatura-confirmada/page.tsx` lines 86 and 112, `conta/(dashboard)/layout.tsx` lines 130
and 144), so every new consumer copies it again.

Evidence the source gives: TAT-175 states managers are using the platform while students and
instructors are not getting registered. It gives no figure.

When this ships, a link a manager pastes into a WhatsApp group opens a page that names their
academy, shows its logo, and puts the store button for the visitor's own platform in front of
them — and the association files land so that TAT-177 can make the same link open the app.

## Flow

Reuses the academy read path that already exists — `AcademyService.getById` over
`PostgresAcademyRepository.findById` and the `academyIdParamSchema` every academy route already
validates with — instead of adding a second way to read an academy.

1. visitor taps `https://apptatame.com.br/convite/<academyId>?papel=aluno` -> `apps/web/app/convite/[academyId]/page.tsx` (new, no door - placement per the Next app router) - a server component; reads the `papel` query token
2. `apps/web/lib/invite.ts` (new, no door) - resolves `papel` to a view model; an absent or unrecognised token degrades to the generic invite, never to an error
3. `GET /v1/academies/:academyId/public` -> `academy.routes.ts` (exists) -> `AcademyService` (exists) - `getPublicById` returns `{ id, name, logoUrl }` or `null` (door 1)
4. out: the page renders the academy heading, the logo, `StoreButtons` (new, no door) with the user-agent match highlighted, and the re-tap sentence
5. out: `/baixar` (new, no door) renders `StoreButtons` and nothing else; `assinatura-confirmada/page.tsx` (exists) and `conta/(dashboard)/layout.tsx` (exists) render it in place of their copied markup
6. out: `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` (new, no door) answer from environment variables, and iOS and Android read them at install time (door 4)

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `public academy view` — the `{ id, name, logoUrl }` projection an unauthenticated caller may read; lives in `academy.service.ts` beside `getById`, which returns the full row |
| domain | new term: `papel` — the Portuguese URL token (`aluno`, `instrutor`, `responsavel`) that *suggests* a role. It is a link parameter, never persisted, and maps onto the existing `Role` values `student`, `instructor`, `guardian`. Nothing branches on it today; TAT-177 and TAT-191 will |
| domain | no existing term changes meaning |
| stored data | nothing to migrate — no schema change, no backfill, no new column |
| existing web pages | `assinatura-confirmada/page.tsx` and `conta/(dashboard)/layout.tsx` lose their inlined store markup. The two blocks are **not identical today** — one uses `Link` with `bg-background` / `hover:bg-surface`, the other `<a target="_blank">` with `bg-surface` / `hover:bg-white/5` — so the shared component carries a surface variant or one of the two call sites changes appearance |
| existing API | `/v1/academies/:academyId/public` is the first route in the academy module with no `requireSession`. The `/v1` global limiter (100/min, `app.ts`) already covers it; no limiter change |
| existing web middleware | none. TAT-176's description claims `apps/web/middleware.ts`'s matcher "already excludes `.json` files" — it does **not**: `js(?!on)` matches `.js` only when *not* followed by `on`, so `assetlinks.json` runs through `clerkMiddleware`. It still passes, because `auth.protect()` is called only for `/conta(.*)`. AC 28 proves the pass-through rather than trusting the claim |

## Relations

`None - no stored-data shape change`

## Surface

Only routes this adds or whose signature changes.

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /v1/academies/:academyId/public` | `academyId` path segment | `id` · `name` · `logoUrl` | `200`, `400`, `404` |
| `GET /convite/<academyId>` | `academyId` path segment, `papel` query token | HTML | `200`, `404` |
| `GET /baixar` | nothing | HTML | `200` |
| `GET /.well-known/apple-app-site-association` | nothing | `application/json` · `applinks.details[].appIDs` · `applinks.details[].components` | `200`, `404` |
| `GET /.well-known/assetlinks.json` | nothing | `application/json` · `relation` · `target.package_name` · `target.sha256_cert_fingerprints` | `200`, `404` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1 — an unauthenticated read of academy name and logo | `academyRouter.get("/:academyId/public", async (req, res, next) => …)` — no `requireSession`, no `authorize`, registered after `GET /:academyId`; `AcademyService.getPublicById(id)` returns `{ id, name, logoUrl } \| null`; the response body has exactly those three keys | Making the existing `GET /:academyId` optionally public — it returns the whole `AcademyRow`, so `pixKey`, `pixKeyType`, `ownerId`, `contactEmail` and `contactPhone` would be readable by anyone holding a uuid. That is not a style preference; it is the academy's Pix key on the open internet |
| 2 — a test runner in `apps/web` | `vitest` devDependency, `apps/web/vitest.config.ts` with `test.environment: "node"`, and `"test": "vitest run"` + `"test:unit": "vitest run"` in `apps/web/package.json` so `turbo run test` picks it up. Node environment, not jsdom + React Testing Library: every decision on these pages lives in a pure module (`resolveInviteView`, `detectPlatform`, `storeLinks`) and the components forward a view model into markup | Proving the web pages with `next build` and `tsc --noEmit` only — neither can fail when `papel=instrutor` renders the wrong label, when an API `500` renders the not-found page, or when the user-agent match picks the wrong store. Those are the only decisions these pages make, so the cheap option proves none of them |
| 3 — `papel` is a Portuguese token with a closed vocabulary | `?papel=aluno` \| `?papel=instrutor` \| `?papel=responsavel`, mapped in `apps/web/lib/invite.ts` to `"student"` \| `"instructor"` \| `"guardian"`; anything else resolves to `null` | `?role=student` with the English `Role` value in the link — TAT-175 fixes the vocabulary as `papel`, the link is read by the Brazilian manager pasting it and by the person receiving it, and once links are circulating in group chats the token cannot be renamed. TAT-177 and TAT-191 both parse this token |
| 4 — the association files are env-driven route handlers | `apps/web/app/.well-known/apple-app-site-association/route.ts` and `apps/web/app/.well-known/assetlinks.json/route.ts`, each returning `new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })` from `IOS_APP_ID` and from `ANDROID_PACKAGE_NAME` + `ANDROID_SHA256_CERT_FINGERPRINTS` (comma-separated), and `404` when the variable is unset | Committing static files under `apps/web/public/.well-known/` — the Android fingerprint differs between the EAS upload certificate and the Play App Signing certificate, so it differs per environment, and a committed file can carry only one set. A wrong fingerprint fails silently: the link just opens the browser |

- Extracting the duplicated store markup into one component is a refactor, not a door — it reverses by inlining it again.
- Nothing else in this change is hard to reverse.

## Criteria

### S1: an unauthenticated caller can read an academy's name and logo (P1)

The landing page has something to render without a session.

**Acceptance Criteria**

1. WHEN an unauthenticated client requests `GET /v1/academies/:academyId/public` with the id of an existing academy THEN the API SHALL respond `200` with a body whose keys are exactly `id`, `name` and `logoUrl`
2. IF the `academyId` path segment is not a uuid THEN the API SHALL respond `400` with `error: "Invalid academy id"`
3. IF no academy has that id THEN the API SHALL respond `404` with `error: "Academy not found"`
4. The API SHALL omit `ownerId`, `pixKey`, `pixKeyType`, `address`, `contactEmail`, `contactPhone`, `foundedAt`, `createdAt` and `updatedAt` from the `GET /v1/academies/:academyId/public` body

**Independent test:** `curl` the endpoint with no `Authorization` header against a seeded academy id, then against a random uuid, then against `not-a-uuid`.

### S2: one definition of the store buttons, used everywhere (P1)

Four consumers render the same two store links from one component instead of four copies.

**Acceptance Criteria**

5. The `StoreButtons` component SHALL render a link to `https://ios.apptatame.com.br` and a link to `https://android.apptatame.com.br`, both present on every render regardless of platform
6. WHEN the `User-Agent` contains `iPhone`, `iPad` or `iPod` THEN `StoreButtons` SHALL mark the App Store link as the highlighted one
7. WHEN the `User-Agent` contains `Android` THEN `StoreButtons` SHALL mark the Google Play link as the highlighted one
8. WHILE the `User-Agent` matches neither iOS nor Android `StoreButtons` SHALL mark neither link as highlighted
9. The system SHALL hold the two store URLs in exactly one module under `apps/web`
10. WHERE a page shows store buttons — `assinatura-confirmada`, `conta/(dashboard)/layout`, `/baixar` and `/convite/[academyId]` — that page SHALL render the shared `StoreButtons` component instead of its own markup

**Independent test:** load `/conta` and `/assinatura-confirmada` with an iPhone user-agent and confirm both show the same two buttons with App Store highlighted; `grep -rc 'ios.apptatame.com.br' apps/web` returns 1.

### S3: a member-facing download page (P1)

The destination of the manager's "share the app" action makes sense to someone who knows nothing about Tatame.

**Acceptance Criteria**

11. WHEN an unauthenticated visitor requests `GET /baixar` THEN the web app SHALL respond `200` with a page that renders `StoreButtons`
12. The `/baixar` page SHALL NOT render `HeroV2`, `FeaturesV2`, `PricingV2` or `FaqV2`

**Independent test:** open `/baixar` in a private window and confirm two store buttons and no pricing.

### S4: an invite link that names the academy and the kind of member (P1)

The invited person sees which academy invited them and as what, without typing a name.

**Acceptance Criteria**

13. WHEN a visitor requests `GET /convite/<id>` for an existing academy THEN the page SHALL respond `200` and render that academy's `name` in the heading
14. WHERE the academy's `logoUrl` is non-null the page SHALL render it as the invite logo
15. IF the academy's `logoUrl` is null THEN the page SHALL render `/icon.png` in its place
16. WHEN `papel` is `aluno`, `instrutor` or `responsavel` THEN the heading SHALL name that kind of member as `Aluno`, `Instrutor` or `Responsável` respectively
17. IF `papel` is absent, empty, or any value other than those three tokens THEN the page SHALL render the generic invite heading, naming no kind of member
18. The `/convite/<id>` page SHALL render the sentence `Já instalou? Toque neste link de novo para entrar direto na academia.`
19. IF `GET /v1/academies/:academyId/public` answers `400` or `404` THEN the page SHALL respond `404` and render a page stating the invite link is invalid, carrying no academy name
20. IF `GET /v1/academies/:academyId/public` is unreachable or answers a `5xx` THEN the page SHALL respond `200` and render the invite with no academy name, still rendering `StoreButtons` and the sentence in AC 18
21. The `/convite/<id>` page SHALL NOT contain the strings `uso único`, `link único`, `exclusivo`, `pessoal` or `válido apenas para`

**Independent test:** open `/convite/<seeded id>?papel=instrutor` and read "Instrutor"; open it with `?papel=xyz` and read the generic heading; open `/convite/<random uuid>` and get the invalid-link page.

### S5: the domain association files TAT-177 consumes (P2)

Without these the universal link silently falls back to the browser.

**Acceptance Criteria**

22. WHEN `GET /.well-known/apple-app-site-association` is requested WHILE `IOS_APP_ID` is set THEN the web app SHALL respond `200` with `content-type: application/json` and a body whose `applinks.details[0].appIDs` contains the value of `IOS_APP_ID`
23. The `apple-app-site-association` body SHALL list `/convite/*` and `/baixar` in `applinks.details[0].components`
24. IF `IOS_APP_ID` is unset THEN the web app SHALL respond `404` to `/.well-known/apple-app-site-association`
25. WHEN `GET /.well-known/assetlinks.json` is requested WHILE `ANDROID_SHA256_CERT_FINGERPRINTS` is set THEN the web app SHALL respond `200` with `content-type: application/json` and a body whose statement carries `relation: ["delegate_permission/common.handle_all_urls"]`, `target.package_name: "com.anonymous.tatame"` and every fingerprint listed in that variable
26. IF `ANDROID_SHA256_CERT_FINGERPRINTS` is unset THEN the web app SHALL respond `404` to `/.well-known/assetlinks.json`
27. The `apple-app-site-association` response SHALL carry no file extension in its path
28. WHEN `/convite/<id>`, `/baixar`, `/.well-known/apple-app-site-association` or `/.well-known/assetlinks.json` is requested with no Clerk session THEN `apps/web/middleware.ts` SHALL respond without a redirect and without a `401`

**Independent test:** `curl -i https://<host>/.well-known/apple-app-site-association` and confirm `200`, `application/json`, and the bundle id; same for `assetlinks.json`.

## Out of scope

| Excluded | Why |
| --- | --- |
| The manager's share and invite actions in the mobile app | TAT-178 |
| Universal / App Link native configuration and in-app routing | TAT-177 — this task only serves the files it consumes |
| Carrying the pending invite through sign-up and onboarding | TAT-191 |
| Deferred deep linking (Branch, Adjust, Install Referrer) | TAT-175 design decision 4 — the store round-trip deliberately loses the query string, and the re-tap is the mechanism |
| Per-person or single-use invite state | TAT-175 — the same link is posted once for dozens of people; no per-person state anywhere |
| Changing `POST /memberships/requests` or `approve()` | TAT-175 design decisions 2 and 3 — the role comes from `req.appAuth!.role` and `approve()` takes none |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Whether the public body echoes `id` | return `{ id, name, logoUrl }` | `id` is the caller's own input, so echoing it leaks nothing, and every other academy response in the repo echoes its subject | n |
| Route shape for the public read | `GET /v1/academies/:academyId/public` | keeps the read in the academy module next to `GET /:academyId`; a separate `/v1/public/*` router would split one entity's reads across two files. Different segment count, so no Express route conflict | n |
| HTTP status for an unknown academy on `/convite` | `404` with a dedicated body via `convite/[academyId]/not-found.tsx` | a wrong id genuinely is not found, and a `200` would let search engines index invite pages for academies that do not exist. "Friendly page instead of a raw 404" is about the body, not the status | n |
| How the academy logo is rendered | plain `<img loading="lazy">`, not `next/image` | the logo URL comes from `R2_PUBLIC_URL`, and `apps/web/next.config.ts` declares no `images.remotePatterns`; adding a remote host there is a wider change than this page needs | n |
| Design reference for the two new pages | none exists — they follow the site's existing tokens (`bg-background`, `bg-surface`, `text-text-secondary`, `--font-sora`, `--font-inter`) | `design.pen` carries no `/convite` or `/baixar` screen, and the Pencil MCP app is not running in this environment | n |
| The ticket's claim that the web middleware matcher excludes `.json` | treat it as false; prove the pass-through instead | `js(?!on)` matches `.js` only when not followed by `on`, so `assetlinks.json` is matched by the matcher and does run through `clerkMiddleware`. It passes anyway because only `/conta(.*)` is protected — AC 28 is the proof rather than the assumption | n |
| Where the `papel` → `Role` mapping lives | `apps/web/lib/invite.ts`, duplicated later in the mobile app rather than shared through `@tatame/types` | `papel` is a URL vocabulary, not a domain type; TAT-177 consumes it in `apps/mobile`, and promoting it to a shared package is that ticket's call once it has a second consumer | n |
| Verification profile | `standard` | the maintainer chose it, and it matches the `profile: standard` declaration already written into `AGENTS.md` on the TAT-187 branch — which is not yet on `dev`, so this feature's `checks.md` pins it explicitly rather than inheriting it | y |
| How the association files get their real values | env-driven route handlers; the maintainer fills `IOS_APP_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` in the deployment environment after this lands | keeps S5 buildable and provable now, and keeps the per-environment fingerprint out of the repository (door 4) | y |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | What is the Apple Team ID (so `IOS_APP_ID` = `<TeamID>.com.anonymous.tatame`) and the SHA-256 certificate fingerprint(s) for the `com.anonymous.tatame` Android package? The maintainer will supply both in the deployment environment rather than now | Both `/.well-known/*` routes answer `404` in every environment, so TAT-177's universal links fall back to the browser. Nothing in S1–S4 is blocked, and `.env.example` documents both variables |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| page `/convite/[academyId]` | empty state — academy with no logo | AC 15 |
| page `/convite/[academyId]` | loading state | n/a - a server component; the HTML arrives already rendered |
| page `/convite/[academyId]` | error state | AC 19, AC 20 |
| page `/convite/[academyId]` | unauthorised state | n/a - a public page; no session is ever required or read |
| page `/convite/[academyId]` | density and ordering | AC 13, AC 16, AC 18 — one academy, heading then store buttons then the re-tap sentence |
| page `/convite/[academyId]` | destructive action confirms | n/a - the page has no action beyond two outbound links |
| page `/baixar` | empty state, loading state, unauthorised state | n/a - static page, no data fetch and no session |
| page `/baixar` | error state | n/a - nothing to fail; the page makes no request |
| page `/baixar` | density and ordering | AC 11, AC 12 |
| page `/baixar` | destructive action confirms | n/a - no action on the page |
| API `GET /v1/academies/:academyId/public` | response shape | AC 1, AC 4 |
| API `GET /v1/academies/:academyId/public` | error shape and codes | AC 2, AC 3 |
| API `GET /v1/academies/:academyId/public` | who may call it | AC 1 — anyone, with no session; that is door 1 |
| API `GET /v1/academies/:academyId/public` | versioning | existing - the `/v1` prefix every route in `app.ts` already carries |
| API `GET /v1/academies/:academyId/public` | rate limit behaviour | existing - the `/v1` global limiter, 100/min, `app.ts` |
| all new `GET /.well-known/*` | response shape | AC 22, AC 23, AC 25, AC 27 |
| all new `GET /.well-known/*` | error shape and codes | AC 24, AC 26 |
| all new `GET /.well-known/*` | who may call it, versioning, rate limits | n/a - the OS fetches them unauthenticated and both formats are fixed by Apple and Google |
| copy on `/convite/[academyId]` | tone, and what the reader does next | AC 18, AC 21 |
| copy on `/baixar` | tone, and what the reader does next | AC 11, AC 12 |

## Sources

- TAT-175 — fixes the link vocabulary (`?papel=aluno|instrutor|responsavel`), the two share destinations, and design decision 4 (no deferred deep linking)
- TAT-176 — the acceptance criteria this plan derives from, and the three findings it records (session-only academy routes, manager-facing landing page, duplicated store markup)
- `AGENTS.md` — user-facing copy in Brazilian Portuguese, code in English, Tailwind `className` on web
