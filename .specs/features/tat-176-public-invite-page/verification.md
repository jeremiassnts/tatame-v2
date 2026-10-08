# TAT-176 — Public invite page, download page and public academy endpoint verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: a2d512ddb366e0827b30364f0022bcba8083ae49..fb9383110bf93b6c0db02e147bd2a9a868061c9c
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 1 returned FAIL on one finding wearing three hats: the `SURFACE_CLASSES` decision table in
`apps/web/components/store-buttons.tsx` had no asserted member, no coverage row, and its collapse
survived the whole suite. `fb93831` adds C36 (both rows of the table, at the component's own
layer) and C37 (the live `surface="background"` argument, exercised where it is actually passed).
Re-injecting the round-1 survivor now **fails** C36, the new surface C37 created has been made to
fail once, and the shared `hrefBlock` helper the fix rewrote was re-checked against the
`data-highlighted` surface it also serves. All 37 checks are proven with located evidence, every
proof re-ran green at `fb93831`, and the one open item — C13's grep-level proof for
`conta/(dashboard)/layout.tsx` — is a named, enumerated, structurally-forced precision gap rather
than a blanket exemption. Reasoning for that judgment is below; it does not carry a FAIL.

Scope of this round, per `verify.md` "Re-verifying after a fix": the fix's diff is
`acaca32..fb93831`, which touched **no production source** — only
`apps/web/components/store-buttons.test.tsx`, the new `apps/web/app/assinatura-confirmada/page.test.tsx`
and `.specs/`. Proofs re-ran in full; everything else is scoped to that diff plus round 1's
non-PASS verdicts, and each section says where it came from.

## Binding sources

`verified at fb93831` (unchanged from round 1). Step 1 is `ui`-only and does not run: the plan
records that no design source exists for either new page (`Assumptions` → "Design reference for
the two new pages | none exists … `design.pen` carries no `/convite` or `/baixar` screen"). No
binding artifact to compare against, nothing recorded as opened.

## Checks

Proofs re-run **in full** at `fb93831` (`verified at fb93831`, four invocations, see `## Gate`).
Citations for `components/store-buttons.test.tsx` are refreshed because the fix moved its lines
(C10, C11, C13, plus the new C36); C37 is new. Every other citation is `carried from acaca32` and
still exact — the fix changed no other file, and each named test was shown individually as having
run and passed at the new HEAD.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | public endpoint `200` with seeded name and logo | `vitest run --project integration src/academy-membership.integration.test.ts` exit 0 at `fb93831` | `apps/api/src/academy-membership.integration.test.ts:301` `expect(res.status).toBe(200)` · `:302` `expect(res.body.name).toBe("Academia do Convite")` · `:303` `expect(res.body.logoUrl).toBe("https://cdn.example/logo-convite.png")` | PASS (carried from acaca32) |
| C2 | body key list `== ["id","logoUrl","name"]` by array equality | same invocation, exit 0 | `apps/api/src/academy-membership.integration.test.ts:326` `expect(Object.keys(res.body).sort()).toEqual(["id", "logoUrl", "name"])`, after `:318` seeds `contactEmail`/`contactPhone`/`address` | PASS (carried from acaca32) |
| C3 | non-uuid id → `400 "Invalid academy id"` | same invocation, exit 0 | `apps/api/src/academy-membership.integration.test.ts:333` `toBe(400)` · `:334` `expect(res.body.error).toBe("Invalid academy id")` | PASS (carried from acaca32) |
| C4 | unseeded uuid → `404 "Academy not found"` | same invocation, exit 0 | `apps/api/src/academy-membership.integration.test.ts:343` `toBe(404)` · `:344` `expect(res.body.error).toBe("Academy not found")` | PASS (carried from acaca32) |
| C5 | public `200` while the guarded sibling `401`, same test, no session | same invocation, exit 0 | `apps/api/src/academy-membership.integration.test.ts:359` `expect(publicRes.status).toBe(200)` · `:360` `expect(guardedRes.status).toBe(401)` | PASS (carried from acaca32) |
| C6 | `getPublicById` → 3-field projection, `null` when absent | `vitest run --project unit` exit 0 at `fb93831` | `apps/api/src/modules/academy/academy.service.test.ts:76` `expect(publicView).toEqual({ id: row.id, name: "Academia Tatame", logoUrl: "https://cdn.example/logo.png" })` · `:88` `expect(await svc.getPublicById(randomUUID())).toBeNull()` | PASS (carried from acaca32) |
| C7 | iPhone, iPad, iPod → `"ios"` | `vitest run` (`apps/web`) exit 0 at `fb93831` | `apps/web/lib/store-links.test.ts:20` `expect(detectPlatform(ua)).toBe("ios")` over `[IPHONE, IPAD, IPOD]` at `:19` | PASS (carried from acaca32) |
| C8 | Android UA → `"android"` | same invocation, exit 0 | `apps/web/lib/store-links.test.ts:25` `expect(detectPlatform(ANDROID)).toBe("android")` | PASS (carried from acaca32) |
| C9 | macOS, Windows, `""`, `undefined` → `null` | same invocation, exit 0 | `apps/web/lib/store-links.test.ts:32-35` `toBeNull()` ×4 | PASS (carried from acaca32) |
| C10 | both hrefs under all 3 highlight states | same invocation, exit 0 | `apps/web/components/store-buttons.test.tsx:29` `expect(html).toContain(\`href="${STORE_LINKS.ios}"\`)` · `:30` android — loop over `HIGHLIGHTS = ["ios","android",null]` (`:8`, `:25`) | PASS (citations refreshed at fb93831) |
| C11 | highlight marks exactly one store, all 3 states | same invocation, exit 0 | `apps/web/components/store-buttons.test.tsx:47-49` `expect(hrefBlock(html, STORE_LINKS.ios)).toContain(\`data-highlighted="${ios}"\`)` · `:50-52` android — table at `:35-40`; helper now bounded by the anchor's own `>` at `:18-20` | PASS (citations refreshed at fb93831) |
| C12 | exactly 1 file under `apps/web` holds each store URL | the `git grep -l` / `wc -l` equality command, verbatim in `## Gate` — exit 0, re-run at `fb93831` | `apps/web/lib/store-links.ts:7-8` — still the single hit, and the fix's new test file references `STORE_LINKS.ios` rather than the literal, which is what keeps this green | PASS (re-verified at fb93831) |
| C13 | 4 consumers each name `StoreButtons`, none inlines a URL | `vitest run` (`apps/web`) exit 0 | `apps/web/components/store-buttons.test.tsx:96-98` `expect(source, \`${relative} must import StoreButtons\`).toContain("StoreButtons")` · `:100-102` `.not.toContain("apptatame.com.br")` over the 4 paths at `:87-92` | PASS — precision gap narrowed to 1 of 4 files (see the note below) |
| C36 | `surface="background"` → `bg-background hover:bg-surface`, `surface="surface"` → `bg-surface hover:bg-white/5`, and the two renders differ | `vitest run components/store-buttons.test.tsx -t "puts each consumer's buttons on the surface it sits on"` exit 0; named test shown individually in the full run | `apps/web/components/store-buttons.test.tsx:73-75` `expect(block, …).toContain(\` ${background} \`)` · `:76` `expect(block, …).toContain(hover)` — over the 2-row table at `:63-66`, for **both** hrefs (`:71`) · `:81-83` `expect(renderToStaticMarkup(<StoreButtons surface="background" />)).not.toBe(renderToStaticMarkup(<StoreButtons surface="surface" />))` | PASS (verified at fb93831) |
| C37 | `assinatura-confirmada` renders both hrefs and `bg-background hover:bg-surface`, and not `hover:bg-white/5` | `vitest run app/assinatura-confirmada/page.test.tsx -t "renders the shared store buttons on the card's surface"` exit 0 | `apps/web/app/assinatura-confirmada/page.test.tsx:26-27` both `href` assertions · `:30` `expect(html).toContain("bg-background hover:bg-surface")` · `:31` `expect(html).not.toContain("hover:bg-white/5")`, over `renderToStaticMarkup(<AssinaturaConfirmadaPage />)` at `:24` | PASS (verified at fb93831) |
| C14 | `await BaixarPage()` renders both hrefs | `vitest run` (`apps/web`) exit 0 | `apps/web/app/baixar/page.test.tsx:35-36`, over `renderToStaticMarkup(await BaixarPage())` at `:27` | PASS (carried from acaca32) |
| C15 | 4 marketing strings absent from `/baixar` | same invocation, exit 0 | `apps/web/app/baixar/page.test.tsx:50` `.not.toContain(phrase)` over `barred` at `:43-48` | PASS (carried from acaca32) |
| C16 | found academy → `academyName` in the view | same invocation, exit 0 | `apps/web/lib/invite.test.ts:51` `expect(view).toEqual({ kind: "ok", academy: ACADEMY, role: "instructor" })` | PASS (carried from acaca32) |
| C17 | 3 `papel` tokens → 3 roles | same invocation, exit 0 | `apps/web/lib/invite.test.ts:26-28` `toBe("student")` / `"instructor"` / `"guardian"` | PASS (carried from acaca32) |
| C18 | 5 unusable `papel` inputs → `null` | same invocation, exit 0 | `apps/web/lib/invite.test.ts:35-39` `toBeNull()` ×5 | PASS (carried from acaca32) |
| C19 | 5 endpoint outcomes → 3 view kinds | same invocation, exit 0 | `apps/web/lib/invite.test.ts:59-61`, `:64-66`, `:67-69`, `:73-75`, `:76-79` | PASS (carried from acaca32) |
| C20 | page renders the academy's name | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:61` `toContain("Academia Gracie Centro")`, over `await ConvitePage(...)` at `:46-50` | PASS (carried from acaca32) |
| C21 | logo src = URL, else `/icon.png` | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:66`, `:72`, `:73` | PASS (carried from acaca32) |
| C22 | 3 tokens → accented labels in the heading | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:85-87` `.toContain(\`>${label}</span>\`)` over the table at `:77-81` | PASS (carried from acaca32) |
| C23 | absent and `xyz` name no kind of member | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:96-99` `.not.toContain(label)` ×3, plus `:94` proving the page resolved | PASS (carried from acaca32) |
| C24 | re-tap sentence under 3 outcomes | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:107-109` | PASS (carried from acaca32) |
| C25 | `400`/`404` → `notFound()`; not-found page carries no name | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:114-117` `.rejects.toThrow(…)` against a regex alternating `NEXT_HTTP_ERROR_FALLBACK;404` and `NEXT_NOT_FOUND`, over `[400, 404]` · `apps/web/app/convite/[academyId]/not-found.test.tsx:20`, `:23` | PASS (carried from acaca32) |
| C26 | `500` and thrown fetch resolve degraded | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:127`, `:128-129`, `:130`, `:133`, over `[{status:500},{throws:true}]` at `:122-125` | PASS (carried from acaca32) |
| C27 | 5 phrases × 3 rendered outcomes absent | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:157` `.not.toContain(phrase)` over `:138-144` × `:145-149`, the 3 outcomes differing via `:152-155` | PASS (carried from acaca32) |
| C28 | AASA `200`, json, `appIDs == [IOS_APP_ID]` | same invocation, exit 0 | `apps/web/app/.well-known/apple-app-site-association/route.test.ts:15`, `:16`, `:21` | PASS (carried from acaca32) |
| C29 | `components` lists `/convite/*` and `/baixar` | same invocation, exit 0 | `apps/web/app/.well-known/apple-app-site-association/route.test.ts:32-33` | PASS (carried from acaca32) |
| C30 | `IOS_APP_ID` unset → `404` | same invocation, exit 0 | `apps/web/app/.well-known/apple-app-site-association/route.test.ts:40` after `:37` | PASS (carried from acaca32) |
| C31 | assetlinks `200`, json, relation / package / both fingerprints in order | same invocation, exit 0 | `apps/web/app/.well-known/assetlinks.json/route.test.ts:28`, `:29`, `:32`, `:33-35`, `:37`, `:41-44` | PASS (carried from acaca32) |
| C32 | fingerprints unset → `404` | same invocation, exit 0 | `apps/web/app/.well-known/assetlinks.json/route.test.ts:50` after `:48` | PASS (carried from acaca32) |
| C33 | real `next build` manifest holds 4 feature routes + live sibling | `bash -c 'pnpm --filter @tatame/web build >/dev/null && node scripts/assert-web-routes.mjs'` → `5 route(s) served`, exit 0, re-run at `fb93831` | `scripts/assert-web-routes.mjs:33-39` `REQUIRED` · `:54` `REQUIRED.filter((route) => !served.has(route))` · `:56-62` exit 1 when non-empty | PASS (re-verified at fb93831) |
| C34 | `isProtectedRoute` false for 4 public paths, true for `/conta/assinatura` | `vitest run` (`apps/web`) exit 0 | `apps/web/middleware.test.ts:20-23` `.toBe(false)` over `PUBLIC_PATHS` (`:10-15`) · `:28` `.toBe(true)` | PASS (carried from acaca32) |
| C35 | `config.matcher[0]` **does** match `assetlinks.json` | same invocation, exit 0 | `apps/web/middleware.test.ts:38` `.toBe(true)` · `:40` `/icon.png` `.toBe(false)` | PASS (carried from acaca32) |

**The fix's own soundness, checked rather than taken on trust** (`verified at fb93831`):

- **C36 pins values, not merely difference.** The assertion is `toContain(\` ${background} \`)`
  with the space delimiters, so it cannot be satisfied by the `hover:bg-surface` occurrence of the
  same token — which is what makes the `background` row genuinely distinguishable from the
  `surface` row. The `not.toBe` at `:81-83` is a second, weaker net, not the one carrying the
  claim. Both hrefs are checked per row (`:71`), so a variant applied to one button only fails.
- **The rewritten `hrefBlock` widened the slice rather than narrowing it.** Fault 1's failure
  output shows the returned block for one anchor in full:
  `href="…" target="_blank" rel="noopener noreferrer" data-highlighted="false" class="flex h-[52px] … bg-surface hover:bg-white/5 border-border hover:border-border-light"`
  — so the slice still contains `data-highlighted` (C10, C11) and now reaches `class`, which the
  old fixed 200-character bound truncated mid-token. Fault 3 confirms C11 still bites.
- **C37 covers something C36 structurally cannot.** With the live argument flipped to
  `surface="surface"` at the call site (fault 2), `components/store-buttons.test.tsx` stayed green
  — `4 passed (4)` — while C37 failed. The two checks are not redundant.
- **Wording note, not a finding:** C37's claim says `await AssinaturaConfirmadaPage()`, while
  `page.tsx:4` exports a synchronous component and the test renders `<AssinaturaConfirmadaPage />`
  at `page.test.tsx:24`. Same assertion surface, same rendered markup; only the claim's phrasing
  is off, and the `await` would be a no-op.

**C13's precision gap — judged, and accepted as named rather than carrying a FAIL.** Round 1
reported that C13 proves two consumers by reading their bytes. One of the two,
`assinatura-confirmada`, is now render-proven by C37. For the remaining one the exemption in
`checks.md` is acceptable on four grounds, each checked against the code:

1. **It enumerates.** It names exactly one file, exactly one claim (the import), and the reason —
   not a blanket "rendering is unproven" clause.
2. **The cited reason is true.** `apps/web/app/conta/(dashboard)/layout.tsx:1` is `"use client"`;
   `:22` `usePathname()`, `:24` `useAuth()`, and the effect at `:28-52` calls
   `managerFetch("/users/me", token)` to set `userStatus`; `<StoreButtons />` sits at `:129`
   inside the `userStatus === "pending-academy"` branch opened at `:108`.
3. **The approved runner structurally cannot reach it.** `apps/web/vitest.config.ts:10` is
   `environment: "node"`, and `renderToStaticMarkup` never runs effects — `userStatus` stays
   `"loading"` and the component returns the spinner at `:53-59`. Reaching `:129` needs jsdom plus
   React Testing Library, which door 2 rejected explicitly and the maintainer approved.
4. **The behaviour at stake is proven elsewhere.** That call site passes no `surface`, so what it
   depends on is the default `"surface"` row — now asserted by C36. What the grep alone covers is
   one JSX element's presence in one branch, bounded on the regression side by
   `:100-102` `.not.toContain("apptatame.com.br")`.

## Coverage

Rows for the `StoreButtons` surface variants and consumers are `verified at fb93831`, recomputed
from the code; every other row is `carried from acaca32`, where it was recomputed from its own
authority, and the fix touched none of those authorities (no production file changed).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `StoreButtons` surface variants (2) — **verified at fb93831** | `apps/web/components/store-buttons.tsx:3` — `type Surface`, whose two members are `"background"` and `"surface"` — plus `:5-11` `SURFACE_CLASSES`, selected at `:80`; `git grep -n "<StoreButtons" -- apps/web` for the live arguments | `"background"` → C36 (`store-buttons.test.tsx:73-76`, row 1 of the table at `:64`) **and** C37 at the one call site that passes it (`assinatura-confirmada/page.test.tsx:30-31`) · `"surface"` → C36 (row 2 at `:65`), the default taken by `conta/(dashboard)/layout.tsx:129`, `convite/[academyId]/not-found.tsx:26` | - |
| `StoreButtons` consumers (4) — **verified at fb93831** | `git grep -n "<StoreButtons" -- apps/web` → `assinatura-confirmada/page.tsx:84`, `conta/(dashboard)/layout.tsx:129`, `baixar/page.tsx:43`, `convite/[academyId]/page.tsx:104` (+ `not-found.tsx:26`, beyond the claim) | `assinatura-confirmada` C13 **+ render C37** · `conta/(dashboard)/layout` C13 (grep level — precision gap named above) · `/baixar` C13, C14 · `/convite/[academyId]` C13, C26 | - |
| `GET /v1/academies/:academyId/public` statuses (3) | `apps/api/src/modules/academy/academy.routes.ts:78-92` — `400` at `:82`, `404` at `:86`, `res.json(row)` otherwise | `200` C1 · `400` C3 · `404` C4 | - |
| academy fields withheld from the public body (9) | `packages/db/src/schema/index.ts:200-220` — 12 columns minus the 3 projected | all 9 (`ownerId`, `address`, `contactEmail`, `contactPhone`, `foundedAt`, `pixKey`, `pixKeyType`, `createdAt`, `updatedAt`) by the single array equality C2, reinforced by C6 | - |
| `GET /convite/<academyId>` statuses (2) | `apps/web/app/convite/[academyId]/page.tsx:72` `if (view.kind === "not-found") notFound();` | `200` C20, C26 · `404` C25 | - |
| `GET /baixar` statuses (1) | `apps/web/app/baixar/page.tsx:19` — no conditional | `200` C14 | - |
| AASA statuses (2) | `apps/web/app/.well-known/apple-app-site-association/route.ts:17-19` / `:35` | `200` C28 · `404` C30 | - |
| assetlinks statuses (2) | `apps/web/app/.well-known/assetlinks.json/route.ts:19-21` / `:35` | `200` C31 · `404` C32 | - |
| AASA body fields named in plan `Surface` (2) | plan `Surface` row | `appIDs` C28 · `components` C29 | - |
| assetlinks body fields named in plan `Surface` (3) | plan `Surface` row | `relation` · `target.package_name` · `target.sha256_cert_fingerprints` — all C31 | - |
| `papel` token vocabulary (4 classes) | `apps/web/lib/invite.ts:16-20` + `?? null` at `:38` | `aluno` C17, C22 · `instrutor` C17, C22 · `responsavel` C17, C22 · anything else C18, C23 | - |
| `papel` unusable inputs (5) | plan AC 17, widened by the checks | `undefined` · `""` · `"xyz"` · `"ALUNO"` · 64 chars — all C18 | - |
| endpoint outcome -> page view (5) | `apps/web/lib/invite.ts:62-79` | `200` C19, C20 · `400` C19, C25 · `404` C19, C25 · `500` C19, C26 · thrown fetch C19, C26 | - |
| `ROLE_LABELS` (3) | `apps/web/lib/invite.ts:22-26` | `Aluno` · `Instrutor` · `Responsável` — all C22 | - |
| user-agent platform classes (4) | `apps/web/lib/store-links.ts:21-24` | iPhone/iPad/iPod C7 · Android C8 · desktop C9 · absent/empty C9 | - |
| `StoreButtons` highlight states (3) | `apps/web/components/store-buttons.tsx:115`, `:123` | `"ios"` C10, C11 · `"android"` C10, C11 · `null` C10, C11 | - |
| `logoUrl` presence (2) | `apps/web/app/convite/[academyId]/page.tsx:77-78` | non-null C21 · null C21 | - |
| copy forbidden on `/convite` (5 × 3 = 15) | plan AC 21 × the 3 rendered outcomes | all 15 pairs C27 | - |
| marketing components barred from `/baixar` (4) | plan AC 12 | all 4 C15 | - |
| middleware paths that must not be challenged (5) | `apps/web/middleware.ts:13` + a live sibling | all 5 C34 | - |
| `.well-known` env vars, absent (2) | `route.ts:16` · `route.ts:14` | `IOS_APP_ID` C30 · fingerprints C32 | - |
| one-way doors (4) | plan `Landing` | door 1 C2, C5 · door 2 `apps/web/vitest.config.ts:4-24` + every `apps/web` proof · door 3 C17, C18 · door 4 C28, C30, C31, C32 | - |
| startup config: Next route registration (2 assemblies) | `apps/web/.next/app-path-routes-manifest.json` from a real build · direct component/handler calls | manifest C33 · direct calls C14, C20, C28, C31, C37 | - |
| startup config: the public academy route is mounted (1 assembly) | `apps/api/src/app.ts:51` `createApp()`, used by `server.ts:46` and the harness at `academy-membership.integration.test.ts:24-25` | `createApp()` C1-C5 | - |

`Swept` rows resolving to **existing** were re-read in round 1 and hold unchanged (`carried from
acaca32`): the uuid constraint at `academy.routes.ts:80`, the exact-match constraint at
`invite.ts:37-38`, and `requireSession` at `academy.routes.ts:58`. The `n/a` rows remain policy,
and the fix introduced no write, schema change or telemetry call.

## Test policy rows

Rows 1 and 3 are `verified at fb93831` (row 1 was the unmet one; both classify a file the fix
touched). Rows 2, 4 and 5 are `carried from acaca32`. `checks.md`'s evidence for
`store-buttons.tsx` was also corrected by the fix, from 2 branch points to 4 — which matches what
the code does.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, in a module reachable without a request | `apps/web/components/store-buttons.tsx` | own layer: C10, C11, **C36** | yes — **verified at fb93831**: the `highlight` table's 3 rows (`store-buttons.test.tsx:47-52`) and now both rows of `SURFACE_CLASSES` (`:73-76`, table at `:63-66`) each have an asserted case. Round 1's single finding sat on this row, and C36 closes it |
| Decides, in a module reachable without a request | `apps/web/lib/invite.ts`, `apps/web/lib/store-links.ts`, `apps/api/src/modules/academy/academy.service.ts` | own layer: C16-C19 · C7-C9 · C6 | yes — carried from acaca32; all rows of all three decision tables asserted (4 token classes, 5 outcomes, 4 UA classes, 2 service branches) |
| A server component composing a decided view model into markup | `apps/web/app/convite/[academyId]/page.tsx`, `not-found.tsx`, **`apps/web/app/assinatura-confirmada/page.tsx`** | `react-dom/server` render: C20-C27, C25, **C37** | yes — **verified at fb93831**: `assinatura-confirmada` now has its own render proof (`page.test.tsx:24-31`) asserting reader-visible output, where round 1 found only a grep. The convite rows carry forward |
| Decides, inside a route handler returning a `Response` | the two `app/.well-known/*/route.ts` | call the exported `GET` directly: C28-C30, C31-C32 | yes — carried from acaca32; each `200` branch asserts status, `content-type` and body together, each `404` branch its bodyless status |
| An app-router route's existence | the 4 new app-router paths + `/assinatura-confirmada` | one over a real `next build` manifest: C33 | yes — carried from acaca32, and the proof was re-run at `fb93831` |
| Instrumentation — presentational markup with no conditional | `apps/web/app/baixar/page.tsx` | none of its own; covered by its consumer | yes — carried from acaca32; C14 and C15 render it |

## Faults injected

`verified at fb93831`. Same deviation from `verify.md` step 4 as round 1, recorded again: the
harness refuses to point git at another directory and a fresh worktree would need its own
`pnpm install`, so faults were applied to the real tree and reverted with `git checkout -- <path>`.
`git status --porcelain` was empty before the first fault (confirmed; round 1's three untracked
`.specs/` files are committed in `fb93831`) and verified empty after every revert. `git stash` was
never used. Scoped to the surfaces the fix touched plus the surface it created, per
"Re-verifying after a fix".

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| round 1's survivor, re-injected: `SURFACE_CLASSES.background` collapsed onto the `surface` classes | `apps/web/components/store-buttons.tsx:9` | `vitest run components/store-buttons.test.tsx -t "puts each consumer's buttons on the surface it sits on"` → failed at `store-buttons.test.tsx:73`, expected `" bg-background "` | yes |
| the live surface argument flipped: `surface="background"` -> `surface="surface"` (the new surface C37 created) | `apps/web/app/assinatura-confirmada/page.tsx:84` | `vitest run app/assinatura-confirmada/page.test.tsx -t "renders the shared store buttons on the card's surface"` → failed at `page.test.tsx:30`; `components/store-buttons.test.tsx` stayed green `4 passed (4)`, so only C37 covers it | yes |
| android highlight predicate changed to `highlight === "ios"` (the `data-highlighted` surface whose helper the fix rewrote) | `apps/web/components/store-buttons.tsx:123` | `vitest run components/store-buttons.test.tsx -t "marks exactly the store matching the platform"` → failed at `store-buttons.test.tsx:50` | yes |

Round 1's other four faults are `carried from acaca32` — the public projection gaining `ownerId`
(killed at `academy-membership.integration.test.ts:326`), `invite.ts:71`'s `400 || 404` narrowed to
`404` (killed at `invite.test.ts:66`), the re-tap sentence reworded (killed at
`page.test.tsx:107`), and `isProtectedRoute` widened (killed at `middleware.test.ts:23`). The fix
touched none of those surfaces. The C33 vacuity control from round 1 also carries forward; C33's
command was nonetheless re-run green at `fb93831`.

## Gate

`pnpm --filter @tatame/api exec vitest run --project unit` - 739 passed, 0 failed
`pnpm --filter @tatame/api exec vitest run --project integration src/academy-membership.integration.test.ts --reporter=verbose` - 12 passed, 0 failed
`pnpm --filter @tatame/web exec vitest run --reporter=verbose` - 30 passed, 0 failed (every named test shown individually, including the two new ones)
`bash -c 'pnpm --filter @tatame/web build >/dev/null && node scripts/assert-web-routes.mjs'` - exit 0, `5 route(s) served`
`bash -c '[ "$(git grep -l ios.apptatame.com.br -- apps/web | wc -l | tr -d " ")" = 1 ] && [ "$(git grep -l android.apptatame.com.br -- apps/web | wc -l | tr -d " ")" = 1 ]'` - exit 0

Tree state after the run: `git status --porcelain` empty, `HEAD` = `fb9383110bf93b6c`. `checks.md`
now declares 37 checks and defines 37 (`C1`-`C37`, counted) — round 1's header discrepancy is
closed.

## Residual, carried openly rather than as a verdict

- **C13 for `conta/(dashboard)/layout.tsx`** stays at grep level, for the four reasons set out
  under `## Checks`. Closing it means jsdom + React Testing Library in `apps/web`, which reverses
  door 2 — a maintainer decision, not a fix.
- **Open, non-blocking (unchanged from the plan):** the Apple Team ID and the Android SHA-256
  fingerprints are unset, so both `/.well-known/*` routes answer `404` in every environment until
  the maintainer fills them. C30 and C32 prove that branch deliberately.
