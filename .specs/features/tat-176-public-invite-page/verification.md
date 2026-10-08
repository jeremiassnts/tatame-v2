# TAT-176 — Public invite page, download page and public academy endpoint verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: a2d512ddb366e0827b30364f0022bcba8083ae49..acaca3219c71d31437eeb262a7cc9fc6f955b6f6
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

One gap, and it is narrow: all 35 checks are proven with located evidence and every proof was
re-run green at `acaca32`, but a 2-member decision table this feature introduced —
`SURFACE_CLASSES` in `apps/web/components/store-buttons.tsx` — has no asserted member in any of
the 28 `apps/web` tests, and the mutant that collapses it **survived** the full suite. That is the
exact regression the plan's `Impact` table named in advance ("the shared component carries a
surface variant **or one of the two call sites changes appearance**"), and it is the only thing
standing between this report and a PASS.

## Binding sources

Step 1 is `ui`-only and did not run: the plan records that no design source exists for either new
page (`Assumptions` → "Design reference for the two new pages | none exists … `design.pen` carries
no `/convite` or `/baixar` screen, and the Pencil MCP app is not running in this environment"), so
there is no binding artifact to compare the checks against. Nothing was recorded as opened.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | public endpoint `200` with seeded name and logo | `vitest run --project integration src/academy-membership.integration.test.ts` exit 0 — named test shown individually | `apps/api/src/academy-membership.integration.test.ts:301` `expect(res.status).toBe(200)` · `:302` `expect(res.body.name).toBe("Academia do Convite")` · `:303` `expect(res.body.logoUrl).toBe("https://cdn.example/logo-convite.png")` | PASS |
| C2 | body key list `== ["id","logoUrl","name"]` by array equality | same invocation, exit 0 | `apps/api/src/academy-membership.integration.test.ts:326` `expect(Object.keys(res.body).sort()).toEqual(["id", "logoUrl", "name"])` — preceded by `:318` `expect(patched.status).toBe(200)` seeding `contactEmail`/`contactPhone`/`address` | PASS |
| C3 | non-uuid id → `400 "Invalid academy id"` | same invocation, exit 0 | `apps/api/src/academy-membership.integration.test.ts:333` `expect(res.status).toBe(400)` · `:334` `expect(res.body.error).toBe("Invalid academy id")` | PASS |
| C4 | unseeded uuid → `404 "Academy not found"` | same invocation, exit 0 | `apps/api/src/academy-membership.integration.test.ts:343` `expect(res.status).toBe(404)` · `:344` `expect(res.body.error).toBe("Academy not found")` | PASS |
| C5 | public `200` while the guarded sibling `401`, same test, no session | same invocation, exit 0 | `apps/api/src/academy-membership.integration.test.ts:359` `expect(publicRes.status).toBe(200)` · `:360` `expect(guardedRes.status).toBe(401)` | PASS |
| C6 | `getPublicById` → 3-field projection, `null` when absent | `vitest run --project unit src/modules/academy/academy.service.test.ts` exit 0 | `apps/api/src/modules/academy/academy.service.test.ts:76` `expect(publicView).toEqual({ id: row.id, name: "Academia Tatame", logoUrl: "https://cdn.example/logo.png" })` · `:88` `expect(await svc.getPublicById(randomUUID())).toBeNull()` | PASS |
| C7 | iPhone, iPad, iPod → `"ios"` | `vitest run` (`apps/web`) exit 0 | `apps/web/lib/store-links.test.ts:20` `expect(detectPlatform(ua)).toBe("ios")` over `[IPHONE, IPAD, IPOD]` at `:19` | PASS |
| C8 | Android UA → `"android"` | same invocation, exit 0 | `apps/web/lib/store-links.test.ts:25` `expect(detectPlatform(ANDROID)).toBe("android")` | PASS |
| C9 | macOS, Windows, `""`, `undefined` → `null` | same invocation, exit 0 | `apps/web/lib/store-links.test.ts:32-35` `expect(detectPlatform(MACOS)).toBeNull()` · `(WINDOWS)` · `("")` · `(undefined)` | PASS |
| C10 | both hrefs under all 3 highlight states | same invocation, exit 0 | `apps/web/components/store-buttons.test.tsx:22` `expect(html).toContain(\`href="${STORE_LINKS.ios}"\`)` · `:23` android — loop over `HIGHLIGHTS = ["ios","android",null]` at `:8`,`:18` | PASS |
| C11 | highlight marks exactly one store, all 3 states | same invocation, exit 0 | `apps/web/components/store-buttons.test.tsx:40` `expect(hrefBlock(html, STORE_LINKS.ios)).toContain(\`data-highlighted="${ios}"\`)` · `:43` android — table `{ios:["true","false"],android:["false","true"],none:["false","false"]}` at `:28-33` | PASS |
| C12 | exactly 1 file under `apps/web` holds each store URL | `bash -c '[ "$(git grep -l ios.apptatame.com.br -- apps/web \| wc -l \| tr -d " ")" = 1 ] && …'` exit 0 (re-run by verifier) | `apps/web/lib/store-links.ts:7-8` `ios: "https://ios.apptatame.com.br"` / `android: "https://android.apptatame.com.br"` — the single hit; `git grep -l apptatame.com.br -- apps/web` returns 8 files, none of the other 7 carrying either store subdomain | PASS |
| C13 | 4 consumers each name `StoreButtons`, none inlines a URL | `vitest run` (`apps/web`) exit 0 | `apps/web/components/store-buttons.test.tsx:59` `expect(source, \`${relative} must import StoreButtons\`).toContain("StoreButtons")` · `:63` `.not.toContain("apptatame.com.br")` over the 4 paths at `:50-55` | PASS (precision gap — see below) |
| C14 | `await BaixarPage()` renders both hrefs | same invocation, exit 0 | `apps/web/app/baixar/page.test.tsx:35-36` `expect(html).toContain(\`href="${STORE_LINKS.ios}"\`)` / android, over `renderToStaticMarkup(await BaixarPage())` at `:27` | PASS |
| C15 | 4 marketing strings absent from `/baixar` | same invocation, exit 0 | `apps/web/app/baixar/page.test.tsx:50` `expect(html, …).not.toContain(phrase)` over `barred` at `:43-48` (HeroV2 h1, FeaturesV2 h2, PricingV2 h2, FaqV2 h2) | PASS |
| C16 | found academy → `academyName` in the view | same invocation, exit 0 | `apps/web/lib/invite.test.ts:51` `expect(view).toEqual({ kind: "ok", academy: ACADEMY, role: "instructor" })` | PASS |
| C17 | 3 `papel` tokens → 3 roles | same invocation, exit 0 | `apps/web/lib/invite.test.ts:26-28` `expect(resolveInviteRole("aluno")).toBe("student")` · `("instrutor")→"instructor"` · `("responsavel")→"guardian"` | PASS |
| C18 | 5 unusable `papel` inputs → `null` | same invocation, exit 0 | `apps/web/lib/invite.test.ts:35-39` `toBeNull()` for `undefined`, `""`, `"xyz"`, `"ALUNO"`, `"a".repeat(64)` | PASS |
| C19 | 5 endpoint outcomes → 3 view kinds | same invocation, exit 0 | `apps/web/lib/invite.test.ts:59-61` `toMatchObject({ kind: "ok" })` · `:64-66` `400 → toEqual({kind:"not-found"})` · `:67-69` `404 → same` · `:73-75` `500 → toEqual({kind:"unavailable", role:"student"})` · `:76-79` thrown fetch → same | PASS |
| C20 | page renders the academy's name | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:61` `expect(html).toContain("Academia Gracie Centro")` over `renderToStaticMarkup(await ConvitePage({params, searchParams}))` at `:46-50` | PASS |
| C21 | logo src = URL, else `/icon.png` | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:66` `expect(withLogo).toContain('src="https://cdn.example/logo.png"')` · `:72` `expect(withoutLogo).toContain('src="/icon.png"')` · `:73` `.not.toContain("cdn.example")` | PASS |
| C22 | 3 tokens → `Aluno`/`Instrutor`/`Responsável` in the heading | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:85-87` `expect(html, \`?papel=${papel} must name ${label}\`).toContain(\`>${label}</span>\`)` over the table at `:77-81`, accented form included | PASS |
| C23 | absent and `xyz` name no kind of member | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:96-99` `expect(html, …).not.toContain(label)` for `["Aluno","Instrutor","Responsável"]`, plus `:94` `toContain("Academia Gracie Centro")` proving the page still resolved | PASS |
| C24 | re-tap sentence under 3 outcomes | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:107-109` `expect(await render("aluno")).toContain(RE_TAP)` · `render(undefined)` · `render("aluno", {status:500})`, `RE_TAP` literal at `:14-15` | PASS |
| C25 | `400`/`404` → `notFound()`; not-found page carries no academy name | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:114-117` `await expect(render("aluno", {status}), …).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404\|NEXT_NOT_FOUND/)` over `[400, 404]` · `apps/web/app/convite/[academyId]/not-found.test.tsx:20` `toContain("Convite inválido")` · `:23` `.not.toContain("Academia Gracie Centro")` | PASS |
| C26 | `500` and thrown fetch resolve with no name, both hrefs, the sentence | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:127` `.not.toContain("Academia Gracie Centro")` · `:128-129` both hrefs · `:130` `toContain(RE_TAP)` · `:133` `toContain(">Instrutor</span>")`, over `[{status:500},{throws:true}]` at `:122-125` | PASS |
| C27 | 5 phrases × 3 rendered outcomes absent | same invocation, exit 0 | `apps/web/app/convite/[academyId]/page.test.tsx:157` `expect(html, \`${name} must not say "${phrase}"\`).not.toContain(phrase)` over `barred` (`:138-144`) × `outcomes` (`:145-149`); the 3 outcomes differ — `papel=aluno`+`200`, `papel=undefined`+`200`, `papel=aluno`+`500` — via the papel switch at `:152-155` | PASS |
| C28 | AASA `200`, json, `appIDs == [IOS_APP_ID]` | same invocation, exit 0 | `apps/web/app/.well-known/apple-app-site-association/route.test.ts:15` `expect(res.status).toBe(200)` · `:16` `expect(res.headers.get("content-type")).toBe("application/json")` · `:21` `expect(body.applinks.details[0]!.appIDs).toEqual([APP_ID])` | PASS |
| C29 | `components` lists `/convite/*` and `/baixar` | same invocation, exit 0 | `apps/web/app/.well-known/apple-app-site-association/route.test.ts:32` `expect(paths).toContain("/convite/*")` · `:33` `toContain("/baixar")` | PASS |
| C30 | `IOS_APP_ID` unset → `404` | same invocation, exit 0 | `apps/web/app/.well-known/apple-app-site-association/route.test.ts:40` `expect(GET().status).toBe(404)` after `:37` `delete process.env.IOS_APP_ID` | PASS |
| C31 | assetlinks `200`, json, one statement, relation / package / both fingerprints in order | same invocation, exit 0 | `apps/web/app/.well-known/assetlinks.json/route.test.ts:28` `toBe(200)` · `:29` `toBe("application/json")` · `:32` `toHaveLength(1)` · `:33-35` `relation toEqual(["delegate_permission/common.handle_all_urls"])` · `:37` `package_name toBe("com.anonymous.tatame")` · `:41-44` `sha256_cert_fingerprints toEqual([UPLOAD_CERT, PLAY_CERT])` | PASS |
| C32 | fingerprints unset → `404` | same invocation, exit 0 | `apps/web/app/.well-known/assetlinks.json/route.test.ts:50` `expect(GET().status).toBe(404)` after `:48` `delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS` | PASS |
| C33 | real `next build` manifest holds 4 feature routes + live sibling, AASA with no extension | `bash -c 'pnpm --filter @tatame/web build >/dev/null && node scripts/assert-web-routes.mjs'` → `assert-web-routes: 5 route(s) served`, exit 0 (re-run by verifier) | `scripts/assert-web-routes.mjs:33-39` `REQUIRED = ["/.well-known/apple-app-site-association", "/.well-known/assetlinks.json", "/baixar", "/convite/[academyId]", "/assinatura-confirmada"]` · `:54` `const missing = REQUIRED.filter((route) => !served.has(route))` · `:56-62` exit 1 when non-empty; manifest read at `:43` holds `"/.well-known/apple-app-site-association/route": "/.well-known/apple-app-site-association"` | PASS |
| C34 | `isProtectedRoute` false for 4 public paths, true for `/conta/assinatura` | `vitest run` (`apps/web`) exit 0 | `apps/web/middleware.test.ts:20-23` `expect(isProtectedRoute(at(pathname)), \`${pathname} must stay public\`).toBe(false)` over `PUBLIC_PATHS` (`:10-15`) · `:28` `expect(isProtectedRoute(at("/conta/assinatura"))).toBe(true)` | PASS |
| C35 | `config.matcher[0]` **does** match `assetlinks.json` (ticket claim false) | same invocation, exit 0 | `apps/web/middleware.test.ts:38` `expect(matcher.test("/.well-known/assetlinks.json")).toBe(true)` · `:40` `expect(matcher.test("/icon.png")).toBe(false)` | PASS |

Scrutiny the brief asked for, settled against the code rather than the author's note:

- **C2 does settle the 9-member row.** `packages/db/src/schema/index.ts:200-220` gives `academies`
  exactly 12 columns; minus `id`, `name`, `logoUrl` that is exactly the 9 the plan names
  (`ownerId`, `address`, `contactEmail`, `contactPhone`, `foundedAt`, `pixKey`, `pixKeyType`,
  `createdAt`, `updatedAt`). `Object.keys(res.body).sort()` under `toEqual` fails on any one of
  them appearing, and fault 1 below proves it does.
- **C5's `401` is the session guard, not something else.** `asAnonymous()`
  (`apps/api/src/testing/integration-clerk-mock.ts:36-38`) makes `getAuth` return
  `{ userId: null }`; `apps/api/src/middleware/require-session.ts:17-20` is the only `401` on that
  path and it is mounted on the sibling at `apps/api/src/modules/academy/academy.routes.ts:58`
  (`academyRouter.get("/:academyId", requireSession, …)`) and absent from the public route at
  `:78`. `apps/api/src/router.ts:77` mounts the router with no blanket guard, and the same test's
  `200` on the public route under the same mock rules out "no session was removed". A missing
  `CLERK_SECRET_KEY` would have produced `503`, not `401` (`require-session.ts:12-15`).
- **C33 cannot pass vacuously.** Independently controlled: with
  `/.well-known/apple-app-site-association/route` deleted from the built manifest (untracked build
  output, restored immediately) the script printed `1 route(s) the build did not produce` and
  exited 1; restored, it exits 0. An unreadable or empty manifest also exits 1 (`:44-51`, `:54`).
- **C35's direction is right.** Reading the matcher at `apps/web/middleware.ts:23` by hand: for
  `/.well-known/assetlinks.json` no alternative of the exclusion group matches the final `.json`
  (`js(?!on)` fails on `json`), so the negative lookahead succeeds and the pattern matches — the
  middleware does run, and the pass-through is `isProtectedRoute`'s. For `/icon.png` the `png`
  alternative matches, so the pattern does not. Both are what the test asserts.
- **C19/C26 split.** All 5 members are asserted at the lib layer (`invite.test.ts:59-79`) and the
  page-level proof genuinely reaches the degraded path: `page.test.tsx:122-125` renders under
  `{status:500}` and `{throws:true}` and asserts the absence of the name together with both hrefs,
  the sentence and the surviving role label.
- **C27's three outcomes really differ.** `page.test.tsx:152-155` switches `papel` between
  `undefined` and `"aluno"`, so the two `200` rows render different headings, and the third is a
  `500`. No outcome is the same render twice.
- **Mocks do not make anything vacuous.** `next/headers` is mocked in
  `page.test.tsx:7-9` and `baixar/page.test.tsx:7-9` only to supply a user-agent; no claim's value
  comes from it. `next/image` is mocked in `baixar/page.test.tsx:14-21` and
  `not-found.test.tsx:5-12`, and neither file asserts anything the stub produces — the convite
  page's logo (C21) is a plain `<img>` and is not mocked at all.

**Precision gap (C13).** The claim says "imports `StoreButtons`" and the assertion is
`toContain("StoreButtons")` over the file's source text, so the check and its proof agree — but
the AC behind it (AC 10) is about *rendering*. For `/baixar` and `/convite/[academyId]` a render
proof exists anyway (C14, C26). For the two pre-existing consumers,
`app/assinatura-confirmada/page.tsx` and `app/conta/(dashboard)/layout.tsx`, the entire proof that
this refactor did not break them is a source-text grep: nothing renders either page in any test.
That is the same soft spot the Coverage gap below reports from the other side.

**Artifact note, not a finding against the code:** `checks.md`'s header reads "33 checks in 5
slices" while the body defines 35 (`C1`–`C35`, counted). All 35 were verified.

## Coverage

Recomputed from the authority over each set, not read back from `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `GET /v1/academies/:academyId/public` statuses (3) | `apps/api/src/modules/academy/academy.routes.ts:78-92` — `400` at `:82`, `404` at `:86`, `res.json(row)` otherwise | `200` C1 · `400` C3 · `404` C4 | - |
| academy fields withheld from the public body (9) | `packages/db/src/schema/index.ts:200-220` — 12 columns, minus the 3 projected | `ownerId` · `address` · `contactEmail` · `contactPhone` · `foundedAt` · `pixKey` · `pixKeyType` · `createdAt` · `updatedAt` — all 9 by the one array equality C2, reinforced at the service layer by C6 | - |
| `GET /convite/<academyId>` statuses (2) | `apps/web/app/convite/[academyId]/page.tsx:72` `if (view.kind === "not-found") notFound();` else render | `200` C20, C26 · `404` C25 | - |
| `GET /baixar` statuses (1) | `apps/web/app/baixar/page.tsx:19` — no conditional, no data fetch | `200` C14 | - |
| AASA statuses (2) | `apps/web/app/.well-known/apple-app-site-association/route.ts:17-19` / `:35` | `200` C28 · `404` C30 | - |
| assetlinks statuses (2) | `apps/web/app/.well-known/assetlinks.json/route.ts:19-21` / `:35` | `200` C31 · `404` C32 | - |
| AASA body fields named in plan `Surface` (2) | plan `Surface` row — `applinks.details[].appIDs`, `…[].components` | `appIDs` C28 · `components` C29 | - |
| assetlinks body fields named in plan `Surface` (3) | plan `Surface` row | `relation` C31 · `target.package_name` C31 · `target.sha256_cert_fingerprints` C31 | - |
| `papel` token vocabulary (4 classes) | `apps/web/lib/invite.ts:16-20` `PAPEL_TO_ROLE` + the `?? null` fallthrough at `:38` | `aluno` C17, C22 · `instrutor` C17, C22 · `responsavel` C17, C22 · anything else C18, C23 | - |
| `papel` unusable inputs (5) | the plan's AC 17 enumeration (absent, empty, other) widened by the checks | `undefined` · `""` · `"xyz"` · `"ALUNO"` · 64 chars — all 5 individually C18 | - |
| endpoint outcome -> page view (5) | `apps/web/lib/invite.ts:62-79` — `catch`, `400\|404`, `!res.ok`, json `catch`, ok | `200` C19, C20 · `400` C19, C25 · `404` C19, C25 · `500` C19, C26 · thrown fetch C19, C26 | - |
| `ROLE_LABELS` (3) | `apps/web/lib/invite.ts:22-26` | `Aluno` · `Instrutor` · `Responsável` — all 3 rendered and asserted C22 | - |
| user-agent platform classes (4) | `apps/web/lib/store-links.ts:21-24` — falsy, iOS regex, Android regex, fallthrough | iPhone/iPad/iPod C7 · Android C8 · desktop C9 · absent/empty C9 | - |
| `StoreButtons` highlight states (3) | `apps/web/components/store-buttons.tsx:115`, `:123` — `highlight === "ios"` / `=== "android"` | `"ios"` C10, C11 · `"android"` C10, C11 · `null` C10, C11 | - |
| **`StoreButtons` surface variants (2)** | `apps/web/components/store-buttons.tsx:3` `type Surface = "background" \| "surface"` + `:5-11` `SURFACE_CLASSES`, selected at `:80`; named in the plan's `Impact` row ("the shared component carries a surface variant **or one of the two call sites changes appearance**") and used at `apps/web/app/assinatura-confirmada/page.tsx:84` `<StoreButtons surface="background" />` | `"surface"` — rendered by C10/C11 but no assertion touches the class it produces · `"background"` — **never rendered in any of the 28 `apps/web` tests** (`git grep -n "<StoreButtons" -- apps/web` shows `surface=` only at the call site, never in a test) | **both members: `surface="background"` and `surface="surface"`** |
| `logoUrl` presence (2) | `apps/web/app/convite/[academyId]/page.tsx:77-78` `view.academy.logoUrl ?? FALLBACK_LOGO` | non-null C21 · null C21 | - |
| `StoreButtons` consumers (4) | `git grep -n "<StoreButtons" -- apps/web` → `assinatura-confirmada/page.tsx:84`, `conta/(dashboard)/layout.tsx:129`, `baixar/page.tsx:43`, `convite/[academyId]/page.tsx:104` (+ `not-found.tsx:26`, beyond the claim) | `assinatura-confirmada` C13 (source text only) · `conta/(dashboard)/layout` C13 (source text only) · `/baixar` C13, C14 · `/convite/[academyId]` C13, C26 | - (see the C13 precision gap) |
| copy forbidden on `/convite` (5 × 3 = 15) | plan AC 21's 5 strings × the 3 outcomes the page renders | all 15 pairs C27, enumerated in the test's own arrays at `page.test.tsx:138-149` | - |
| marketing components barred from `/baixar` (4) | plan AC 12 — `HeroV2`, `FeaturesV2`, `PricingV2`, `FaqV2` | all 4 C15, one identifying string each | - |
| middleware paths that must not be challenged (5) | `apps/web/middleware.ts:13` `createRouteMatcher(["/conta(.*)"])` against the 4 new paths + a live sibling | `/convite/<uuid>` · `/baixar` · AASA · `assetlinks.json` · `/conta/assinatura` — all 5 C34 | - |
| `.well-known` env vars, absent (2) | `route.ts:16` `process.env.IOS_APP_ID` · `route.ts:14` `process.env.ANDROID_SHA256_CERT_FINGERPRINTS` | `IOS_APP_ID` C30 · fingerprints C32 | - |
| one-way doors (4) | plan `Landing` | door 1 C2, C5 · door 2 `apps/web/vitest.config.ts:4-24` + every `apps/web` proof · door 3 C17, C18 · door 4 C28, C30, C31, C32 | - |
| startup config: Next route registration (2 assemblies) | `apps/web/.next/app-path-routes-manifest.json` from a real build (read directly) · direct component/handler calls | manifest C33 (19 entries, the 5 required among them) · direct calls C14, C20, C28, C31 | - |
| startup config: the public academy route is mounted (1 assembly) | `apps/api/src/app.ts:51` `createApp()`, used by `apps/api/src/server.ts:46` and by the integration harness at `academy-membership.integration.test.ts:24-25` — one assembly, read directly, so the collapse in `checks.md` is correct | `createApp()` C1-C5 | - |

`Swept` rows that resolve to **existing** were re-read against the code and hold: the uuid
constraint C3 cites is `academyIdParamSchema.safeParse(req.params)` at
`academy.routes.ts:80`; the exact-match constraint C18 cites is `PAPEL_TO_ROLE[papel] ?? null` at
`invite.ts:38` with the `typeof papel !== "string"` guard at `:37`; the authorization constraint C5
cites is `requireSession` at `academy.routes.ts:58`, still present on every other academy route in
the diff. The `n/a` rows (idempotency, concurrency, data lifecycle, state transitions,
observability) are policy — and consistent with the code: all five new routes are `GET`, and the
diff contains no write, no schema change and no telemetry call.

## Test policy rows

Judged against the 5 rows in `checks.md` (the two `AGENTS.md` rows it adopts live on the TAT-187
branch and are not on this one — confirmed: this branch's `AGENTS.md` carries no `### Test policy`
section).

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decides, in a module reachable without a request | `apps/web/lib/invite.ts`, `apps/web/lib/store-links.ts`, `apps/api/src/modules/academy/academy.service.ts` | own layer: C16-C19 · C7-C9 · C6 | yes — every row of all three decision tables asserted (4 token classes, 5 outcomes, 4 UA classes, 2 service branches) |
| Decides, in a module reachable without a request | `apps/web/components/store-buttons.tsx` | own layer: C10, C11 | **no** — the `highlight` table's 3 rows are asserted, but the `SURFACE_CLASSES` table (`store-buttons.tsx:5-11`, 2 rows) has **no asserted case**: `"background"` is never rendered in a test and no assertion reads the class either variant produces. The row demands "one asserted case per row of the decision table" |
| Decides, inside a route handler returning a `Response` | `apps/web/app/.well-known/apple-app-site-association/route.ts`, `apps/web/app/.well-known/assetlinks.json/route.ts` | call the exported `GET` directly: C28-C30, C31-C32 | yes — the `200` branch of each asserts status, `content-type` and body together (`route.test.ts:15,16,21` / `:28,29,32-44`); the `404` branch returns a bodyless `Response`, so status is the whole of it (`:40` / `:50`) |
| A server component composing a decided view model into markup | `apps/web/app/convite/[academyId]/page.tsx`, `apps/web/app/convite/[academyId]/not-found.tsx` | `await Page(props)` through `react-dom/server`: C20-C27, C25 | yes — `renderToStaticMarkup(await ConvitePage(...))` at `page.test.tsx:46-50` covers all four rendered outcomes and asserts reader-visible text; `not-found.tsx` is synchronous and propless, rendered at `not-found.test.tsx:18` |
| An app-router route's existence | the 4 new app-router paths + `/assinatura-confirmada` | one over `.next/app-path-routes-manifest.json` from a real `next build`: C33 | yes — re-run by the verifier against a fresh build, and negative-controlled (a dropped entry exits 1) |
| Instrumentation — presentational markup with no conditional | `apps/web/app/baixar/page.tsx` | none of its own; covered by its consumer | yes — C14 and C15 render it and assert both the links and the absent marketing |

## Faults injected

Deviation from `verify.md` step 4, recorded as instructed: the harness refuses to point git at
another directory and a fresh worktree would need its own `pnpm install`, so faults were applied
to the real tree at `acaca32` and reverted with `git checkout -- <path>`. `git status --porcelain`
was empty before the first fault and verified empty after every revert; `git stash` was never used.
Cap of five observed, so three surfaces went unmutated (see below).

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| public projection gains `ownerId` | `apps/api/src/modules/academy/academy.service.ts:52` | `--project integration … -t "exposes nothing beyond id, name and logoUrl"` → failed at `academy-membership.integration.test.ts:326`, diff showed `+ "ownerId"` | yes |
| `res.status === 400 \|\| res.status === 404` narrowed to `=== 404` | `apps/web/lib/invite.ts:71` | `vitest run lib/invite.test.ts -t "turns each endpoint outcome into its own view"` → failed at `invite.test.ts:66`, `not-found` vs `unavailable` | yes |
| re-tap sentence reworded | `apps/web/app/convite/[academyId]/page.tsx:107` | `vitest run 'app/convite/[academyId]/page.test.tsx' -t "closes the loop with the re-tap sentence"` → failed at `page.test.tsx:107` | yes |
| `isProtectedRoute` widened to `["/conta(.*)", "/convite(.*)"]` | `apps/web/middleware.ts:13` | `vitest run middleware.test.ts -t "challenges only the manager account area"` → failed at `middleware.test.ts:23` | yes |
| `SURFACE_CLASSES.background` collapsed onto the `surface` classes (`"bg-background hover:bg-surface"` -> `"bg-surface hover:bg-white/5"`) | `apps/web/components/store-buttons.tsx:9` | whole `apps/web` suite — `9 passed (9) / 28 passed (28)`, nothing failed | **no — survived** |

Non-counted vacuity control on C33 (the manifest is untracked build output, so the tracked tree was
never touched): deleting `/.well-known/apple-app-site-association/route` from
`apps/web/.next/app-path-routes-manifest.json` made `node scripts/assert-web-routes.mjs` print
`1 route(s) the build did not produce` and exit 1; restoring it returned exit 0.

Unmutated surfaces, named because the cap bound rather than because they looked safe:
`detectPlatform` (C7-C9), the `highlight` branch of `StoreButtons` (C10, C11), and the
`.well-known` route handlers' bodies (C28-C32). Their assertions read concrete values at the
assertion site (`toBe("ios")`, `data-highlighted="true"` scoped to the matching href block,
`toEqual([UPLOAD_CERT, PLAY_CERT])`), so the vacuity risk there is low; the surviving mutant above
consumed the budget that would otherwise have gone to one of them.

## Gate

`pnpm --filter @tatame/api exec vitest run --project unit` - 739 passed, 0 failed
`pnpm --filter @tatame/api exec vitest run --project integration src/academy-membership.integration.test.ts` - 12 passed, 0 failed
`pnpm --filter @tatame/web exec vitest run --reporter=verbose` - 28 passed, 0 failed (every named test shown individually)
`bash -c 'pnpm --filter @tatame/web build >/dev/null && node scripts/assert-web-routes.mjs'` - exit 0, `5 route(s) served`
`bash -c '[ "$(git grep -l ios.apptatame.com.br -- apps/web | wc -l | tr -d " ")" = 1 ] && [ "$(git grep -l android.apptatame.com.br -- apps/web | wc -l | tr -d " ")" = 1 ]'` - exit 0

Tree state after the run: `git status --porcelain` empty, `HEAD` = `acaca3219c71d31`.

## Ranked gaps

1. **The `Surface` variant of `StoreButtons` is decided but never asserted — surviving mutant.**
   `apps/web/components/store-buttons.tsx:5-11` (`SURFACE_CLASSES`), selected at `:80`, with
   `surface="background"` live at `apps/web/app/assinatura-confirmada/page.tsx:84` and the default
   `"surface"` live at `apps/web/app/conta/(dashboard)/layout.tsx:129`. Collapsing the two entries
   leaves all 28 `apps/web` tests green, which is exactly the "one of the two call sites changes
   appearance" failure the plan's `Impact` table wrote down in advance: `assinatura-confirmada`'s
   buttons would render `bg-surface` on a `bg-surface` card. Unmet `Test policy` row 1, unproven
   2-member coverage set, surviving mutant — one finding wearing three hats.
   *Smallest fix:* extend `components/store-buttons.test.tsx` with one table-driven case per
   `Surface` value asserting the class each produces (and, optionally, a coverage row for the
   2-member set). Nothing in the product has to change.
2. **Secondary, not verdict-deciding — the two pre-existing consumers are proven by source text
   only.** `apps/web/components/store-buttons.test.tsx:59` asserts
   `toContain("StoreButtons")` against the file's bytes for
   `app/assinatura-confirmada/page.tsx` and `app/conta/(dashboard)/layout.tsx`; neither page is
   rendered anywhere in the suite, so AC 10's "SHALL render" is, for those two, proven at the
   level of a grep. Recorded as a precision gap in the checks rather than a defect in the code.
