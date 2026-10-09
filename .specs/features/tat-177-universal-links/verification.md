# TAT-177 Universal Links verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: `origin/jeremiassnts3/tat-175-let-managers-invite-new-members-with-a-shareable-smart..HEAD` (`d7cb5a2`..`2bc2190`)
**Fix diff this round**: `8cf3461..2bc2190`
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 1 returned a non-PASS verdict on three findings: one surviving mutant and two unproven
coverage members. All three are closed at `2bc2190` by C29, C30 and C31, each independently made
to fail once. Every proof was re-run in full at the new `HEAD`. Nothing else in the feature moved:
the fix touched four files, three of them artifacts.

**Scope of this round.** The fix diff is `.specs/.../checks.md`, `.specs/.../plan.md`,
`.specs/.../verification.md` and `apps/mobile/lib/invite-link.test.ts` - confirmed with
`git diff --name-only 8cf3461..2bc2190`. **No production code changed**, confirmed by blob hash
rather than by diff output: `apps/mobile/lib/invite-link.ts` (`09cf3835`),
`apps/mobile/lib/pending-invite.ts` (`61b4e617`), `apps/mobile/app/+native-intent.ts`
(`c108dc9e`), `apps/mobile/app.json` (`ad95d479`), `packages/types/src/index.ts` (`867d52cc`),
`apps/web/lib/invite.ts` (`6ed56e5d`) and `apps/mobile/vitest.config.ts` (`a7dd5e2b`) are
byte-identical across `8cf3461..2bc2190`. Every set whose authority is production code therefore
carries forward; only the three new assertion surfaces, the rows they changed, and the two
previously unmet `Test policy` rows were re-derived.

## Binding sources

**Carried from `8cf3461`.** No binding sources: the plan marks none, `design.pen` carries no screen
for this work, and the feature renders no UI (`Observable`: "this feature renders nothing"). Steps
1 and 5 do not apply. The fix touched no interface, so there is nothing for this round to re-open.

## Checks

**Verified at `2bc2190`** - all 31 proofs re-run in full, green is a property of a commit.
Citations for `apps/mobile/lib/invite-link.test.ts` are refreshed (the file grew by 45 lines);
citations in the three untouched test files are carried from `8cf3461` with their proofs re-run.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | resolved `ios.associatedDomains` array-equals `["applinks:apptatame.com.br"]` | mobile batch, `-t "claims the invite domain for iOS"` - ran, passed | `apps/mobile/link-config.test.ts:43` - `expect(resolved.ios?.associatedDomains).toEqual([\`applinks:${HOST}\`])` | PASS |
| C2 | exactly one `VIEW` + `autoVerify` filter, `category` has `BROWSABLE` and `DEFAULT` | mobile batch, `-t "declares one auto-verified browsable view filter"` - ran, passed | `apps/mobile/link-config.test.ts:50,56,57` - `expect(ours).toHaveLength(1)`; `expect(categories).toContain("BROWSABLE")`; `expect(categories).toContain("DEFAULT")` | PASS |
| C3 | that filter's `data` contains `{scheme:"https",host,pathPrefix:"/convite/"}` | mobile batch, `-t "claims every invite path on Android"` - ran, passed | `apps/mobile/link-config.test.ts:64` - `expect(data).toContainEqual({ scheme: "https", host: HOST, pathPrefix: "/convite/" })` | PASS |
| C4 | that filter's `data` contains `{scheme:"https",host,path:"/baixar"}` | mobile batch, `-t "claims the download page on Android"` - ran, passed | `apps/mobile/link-config.test.ts:75` - `expect(data).toContainEqual({ scheme: "https", host: HOST, path: "/baixar" })` | PASS |
| C5 | resolved `scheme` equals `tatame` | mobile batch, `-t "keeps the tatame scheme"` - ran, passed | `apps/mobile/link-config.test.ts:83` - `expect(resolved.scheme).toBe("tatame")` | PASS |
| C6 | the asserted object is `@expo/config`'s resolution, not `app.json`'s bytes | mobile batch, `-t "reads the config Expo resolves, not the file on disk"` - ran, passed | `apps/mobile/link-config.test.ts:94,95` - `expect(resolved.sdkVersion).toBe("57.0.0")`; `expect(resolved.ios?.infoPlist?.UILaunchStoryboardName).toBe("SplashScreen")`; assembly constructed at `apps/mobile/link-config.test.ts:20-26` | PASS |
| C7 | apex invite URL -> `{academyId, role:"student"}` | mobile batch, `-t "reads the academy and the suggested role out of an invite link"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:36-39` - `expect(parseInviteLink(\`${HOST}/convite/${ID}?papel=aluno\`)).toEqual({ academyId: ID, role: "student" })` | PASS |
| C8 | 3 tokens -> `student` / `instructor` / `guardian`, table-driven | mobile batch, `-t "maps each papel token to its role"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:43-47` table, asserted `:50-53` - `.toEqual({ academyId: ID, role })` | PASS |
| C9 | 6 unusable `papel` inputs keep `academyId`, `role:null` | mobile batch, `-t "degrades an unusable papel to no suggested role"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:60-67` 6 members, asserted `:70-73` - `.toEqual({ academyId: ID, role: null })` | PASS |
| C10 | `/convite/a%20b` -> `academyId` `"a b"` | mobile batch, `-t "decodes the academy segment"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:78-81` - `.toEqual({ academyId: "a b", role: null })` | PASS |
| C11 | 4 path shapes after `/convite` -> `null` | mobile batch, `-t "refuses a path that is not exactly one segment after convite"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:89` 4 members, asserted `:92` - `expect(parseInviteLink(\`${HOST}${path}\`)).toBeNull()` | PASS |
| C12 | 4 URL forms deep-equal **each other** | mobile batch, `-t "reads one invite the same way in every URL form"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:99-104` forms, asserted `:107-109` - `expect(results[0]).toEqual({ academyId: ID, role: "student" })` then `expect(result).toEqual(results[0])` | PASS |
| C13 | 4 wrong-host / wrong-path URLs -> `null` | mobile batch, `-t "accepts the apex host and that path only"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:117-122` 4 members, asserted `:125` - `expect(parseInviteLink(url)).toBeNull()` | PASS |
| C14 | 5 unparseable inputs -> `null`, no throw | mobile batch, `-t "returns null instead of throwing on an unparseable url"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:130-132` - `expect(() => parseInviteLink(url)).not.toThrow()`; `expect(parseInviteLink(url)).toBeNull()` | PASS |
| C15 | invite -> `setPendingInvite` once with the parser's own output | mobile batch, `-t "hands the parsed invite to the pending-invite store"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:23,24` - `expect(readPendingInvite()).toEqual(parseInviteLink(INVITE))`; `.toEqual({ academyId: ID, role: "instructor" })` | PASS |
| C16 | invite -> returns `"/"` | mobile batch, `-t "sends an invite to the app root"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:30` - `expect(redirectSystemPath({ path: INVITE, initial: true })).toBe("/")` | PASS |
| C17 | `https://apptatame.com.br/baixar` -> returns `"/"` | mobile batch, `-t "sends the download page to the app root"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:34` - `expect(redirectSystemPath({ path: DOWNLOAD, initial: false })).toBe("/")` | PASS |
| C18 | a stored invite survives `/baixar`, `sso-callback`, unknown - 3 members | mobile batch, `-t "leaves a stored invite alone for every other url"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:38` 3 members, asserted `:42` - `expect(readPendingInvite()).toEqual(STORED)` | PASS |
| C19 | 5 other URLs returned by string identity | mobile batch, `-t "returns every other url untouched"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:51-57` 5 members, asserted `:60` - `expect(redirectSystemPath({ path, initial: false })).toBe(path)` | PASS |
| C20 | 4 URL classes x both `initial` values compared against each other | mobile batch, `-t "behaves the same on a cold start as on a resume"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:77,78` - `expect(warm).toBe(cold)`; `expect(afterWarm).toEqual(afterCold)` over `[INVITE, DOWNLOAD, SSO, UNKNOWN]` (`:68`) | PASS |
| C21 | a freshly imported store answers `null` | mobile batch, `-t "holds nothing before an invite arrives"` - ran, passed | `apps/mobile/lib/pending-invite.test.ts:22` - `expect(fresh.readPendingInvite()).toBeNull()` after `vi.resetModules()` at `:20-21` | PASS |
| C22 | last write wins | mobile batch, `-t "keeps the most recent invite"` - ran, passed | `apps/mobile/lib/pending-invite.test.ts:31,32` - `expect(readPendingInvite()).toEqual(B)`; `.not.toEqual(A)` | PASS |
| C23 | `clearPendingInvite` -> `null` | mobile batch, `-t "forgets the invite when cleared"` - ran, passed | `apps/mobile/lib/pending-invite.test.ts:38` - `expect(readPendingInvite()).toBeNull()` | PASS |
| C24 | `resolvePapelToRole`: 3 tokens + 5 rejects | mobile batch, `-t "resolves the shared papel vocabulary and nothing outside it"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:11-13` - `.toBe("student"/"instructor"/"guardian")`; `:18-22` - `.toBeNull()` for `"ALUNO"`, `" aluno"`, `""`, `undefined`, `["aluno"]` | PASS |
| C25 | exactly one file under `apps`+`packages` holds `instrutor: "instructor"`, and it is `packages/types/src/index.ts` | the `git grep -l … -- apps packages` equality command quoted in `checks.md`, run verbatim - exit 0 | the equality is the assertion; the scoped grep returns exactly `packages/types/src/index.ts`, mapping at `packages/types/src/index.ts:31`. `PAPEL_TO_ROLE` is declared once, `packages/types/src/index.ts:29` | PASS |
| C26 | `apps/web`'s `resolveInviteRole` unchanged behaviour through the shared module | `pnpm --filter @tatame/web exec vitest run lib/invite.test.ts --reporter=verbose -t "<2-name alternation>"` - both named tests ran, passed (2 passed, 2 skipped) | `apps/web/lib/invite.test.ts:26-28` - `.toBe("student"/"instructor"/"guardian")`; `:34-38` - `.toBeNull()` for `undefined`, `""`, `"xyz"`, `"ALUNO"`, `"a".repeat(64)`. Subject: `apps/web/lib/invite.ts:21` is `export const resolveInviteRole = resolvePapelToRole;` | PASS |
| C27 | after a real `next build`, the route manifest still holds every TAT-176 route | `bash -c 'pnpm build && pnpm --filter @tatame/web build && node scripts/assert-web-routes.mjs'` - exit 0, "5 route(s) served" | `scripts/assert-web-routes.mjs:33-39` required list, asserted `:54` - `REQUIRED.filter((route) => !served.has(route))` over the manifest the build produced | PASS |
| C28 | the committed lockfile matches both changed manifests | `pnpm install --frozen-lockfile` - exit 0 | pnpm's own manifest-vs-lockfile comparison; subjects `apps/mobile/package.json:13-14` and `apps/web/package.json:18` | PASS |
| C29 | `isDownloadLink` over 7 outcomes at its own layer | mobile batch, `-t "tells the download page apart from everything else"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:155,157-158,159,160` - `.toBe(true)` for bare `/baixar`, `/baixar?utm_source=whatsapp`, `tatame:///baixar`, `/baixar`; `:164,165,166-168` - `.toBe(false)` for `/baixar/extra`, `https://example.com/baixar`, an invite link | PASS |
| C30 | `/convite/%` -> `null` by way of the `decodeURIComponent` catch | mobile batch, `-t "returns null when the academy segment cannot be decoded"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:143,144,145` - `expect(new URL(url).pathname).toBe("/convite/%")` pins the input at that line; `expect(() => parseInviteLink(url)).not.toThrow()`; `expect(parseInviteLink(url)).toBeNull()` | PASS |
| C31 | `resolvePapelToRole(null)` -> `null` | mobile batch, `-t "rejects a null papel"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:30` - `expect(resolvePapelToRole(null)).toBeNull()` | PASS |

Mobile batch = one invocation:
`pnpm --filter @tatame/mobile exec vitest run link-config.test.ts lib/invite-link.test.ts lib/pending-invite.test.ts "app/+native-intent.test.ts" --reporter=verbose -t "<27-name alternation>"`
- **27 passed (27), 4 files**, each named test shown individually. Every name was first located with
`rg -n` (the three new ones at `apps/mobile/lib/invite-link.test.ts:25,136,150`), so no filter
matched nothing; `rg -c "^\s*it\("` across the four files totals 27, which equals the run count, so
the alternation covers the whole mobile suite with nothing filtered out silently.

## Coverage

Recomputed, not read back. Rows whose authority is production code are **carried from `8cf3461`**
because every production blob is byte-identical across the fix diff (hashes above). Rows marked
**verified at `2bc2190`** are the ones the fix added or changed, plus the two whose `Unproven` cells
round 1 filled.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `papel` token vocabulary (4 classes) - carried from `8cf3461` | `PAPEL_TO_ROLE` + the `?? null` fallthrough, `packages/types/src/index.ts:29-33,49` | `aluno` C8/C24 · `instrutor` C8/C24 · `responsavel` C8/C24 · else C9/C24 | - |
| `papel` unusable inputs (6) - carried from `8cf3461` | the exact-match rule `packages/types/src/index.ts:49` + the array branch `apps/mobile/lib/invite-link.ts:105` | absent, `""`, `xyz`, `ALUNO`, `%20aluno`, repeated `papel` - all 6 at `apps/mobile/lib/invite-link.test.ts:60-67` | - |
| shared resolver non-string inputs (4) - **verified at `2bc2190`** | the declared signature `packages/types/src/index.ts:46` + the `typeof` guard `:48`; three non-string classes exist (`string[]`, `null`, `undefined`) | `string[]` C24 (`:22`) · `undefined` C24 (`:21`) · `null` **C31** (`:30`) · `" aluno"` C24 (`:19`), a string the row counts here | - |
| URL forms that must resolve to one invite (4) - carried from `8cf3461` | `extractLinkPath`'s 4 branches, `apps/mobile/lib/invite-link.ts:45,47-48,57-62,64-65` | `https` apex C7/C12 · `tatame:///` C12 · `exp://…/--/` C12 · bare path C12 | - |
| URL forms refused by host and path (4) - carried from `8cf3461` | host exact-match `apps/mobile/lib/invite-link.ts:60` + `INVITE_SEGMENT` guard `:88` | `example.com` · `www.` · `apptatame.com.br.evil.com` · apex non-invite path - all C13 (`:117-122`) | - |
| invite path shapes refused (4) - carried from `8cf3461` | `segments.length !== 2`, `apps/mobile/lib/invite-link.ts:88` | `/convite/` · `/convite` · `/convite//` · `/convite/<id>/extra` - all C11 (`:89`) | - |
| unparseable inputs (5) - carried from `8cf3461` | the `new URL` catch, `apps/mobile/lib/invite-link.ts:51-55`, and the empty-string guard `:44` | `""`, `not a url`, `://`, `tatame://`, `%` - all C14 (`:130-132`) | - |
| where an unusable URL is refused (3 paths) - **verified at `2bc2190`** | the refusal sites in `apps/mobile/lib/invite-link.ts`: `new URL` catch `:51-55`, segment guard `:88`, `decodeURIComponent` catch `:91-95` (the empty-string guard at `:44` is a fourth, covered by C14's `""`) | `new URL` C14 · segment guard C11, C14 (`tatame://` reduces to path `""`) · decode catch **C30** (`:142-145`). Fault R2-F2 confirms the third is reached only by C30 | - |
| `redirectSystemPath` URL classes (4) - **verified at `2bc2190`** | the 3 outcomes in `apps/mobile/app/+native-intent.ts:31-44`; the `/baixar` class recomputed from `isDownloadLink` `apps/mobile/lib/invite-link.ts:111`, whose query-strip member round 1 found unproven | invite C15/C16/C20 · `/baixar` bare C17/C18/C20 **and with a query string C29** (`:157-158`) · `sso-callback` C18/C19/C20 · unknown C18/C19/C20 | - |
| `isDownloadLink` outcomes (7) - **verified at `2bc2190`** | the function body `apps/mobile/lib/invite-link.ts:110-111` composed with `extractLinkPath`'s branches - two branch points, the query strip and the equality | bare `/baixar`, with a query, `tatame:///baixar`, relative path, deeper path, foreign host, an invite link - all 7 C29 (`:155-168`), the last also C16 | - |
| `initial` values (2) - carried from `8cf3461` | the destructured parameter `apps/mobile/app/+native-intent.ts:20-30` | `true` and `false` compared against each other over all 4 classes, C20 (`apps/mobile/app/+native-intent.test.ts:68-78`) | - |
| pending-invite store states (4) - carried from `8cf3461` | the single `let` and its 3 writers, `apps/mobile/lib/pending-invite.ts:18,25-35` | empty C21 · written C15/C22 · overwritten C22 · cleared C23 | - |
| `app.json` link claim, per platform (2) - carried from `8cf3461` | `apps/mobile/app.json:13-15` (iOS), `:37-58` (Android) | iOS C1/C6 · Android C2/C3/C4/C6 | - |
| Android `data` items the claim needs (2) - carried from `8cf3461` | `apps/mobile/app.json:46-55` | `pathPrefix: "/convite/"` C3 · `path: "/baixar"` C4 | - |
| Android filter attributes the OS requires (4) - carried from `8cf3461` | `apps/mobile/app.json:39-44` | `action: VIEW`, `autoVerify: true`, `BROWSABLE`, `DEFAULT` - all C2 (`apps/mobile/link-config.test.ts:50-57`) | - |
| one-way doors (5) - **verified at `2bc2190`** (door 4's span widened to C1-C31) | plan `Landing` rows 1-5 | door 1 C1-C6 · door 2 C15-C20 · door 3 C15/C21/C22/C23 · door 4 all 27 mobile proofs, `apps/mobile/vitest.config.ts` · door 5 C24-C27 | - |
| startup config: the Expo config resolution (1 assembly) - carried from `8cf3461` | read directly: constructed at `apps/mobile/link-config.test.ts:20-26`, `execFileSync(.../expo, ["config","--type","introspect","--json"])` with `cwd` = `apps/mobile` | C1-C6, with C6 (`:94-95`) as the negative control | - |
| startup config: `apps/web`'s dependency graph (3 assemblies) - carried from `8cf3461` | read directly: `next build` manifest (`scripts/assert-web-routes.mjs:28-31`), `apps/web` vitest, `pnpm install --frozen-lockfile` | C27 (ran, 5 routes) · C26 (ran, 2 passed) · C28 (ran, exit 0) | - |

**Re-swept for sets the three new checks created with no row.** Round 1's one unrowed set,
`isDownloadLink`'s outcomes, now has its own row. Two new sub-sets appear and both are covered:
the `/baixar` path's URL forms (the `exp://…/--/baixar` cell is the one C29 does not name - covered
by composition, since C12 proves all four forms reduce identically through the same
`extractLinkPath` and C29 proves the predicate over three of them; probed in the scratch tree at
`HEAD`, `isDownloadLink("exp://192.168.0.2:8081/--/baixar")` is `true`, with and without a query),
and the decode-reject's position in the refusal order, which the new "where an unusable URL is
refused" row carries. `Surface` is still `None - nothing consumed outside` and `Relations` still
`None - no stored-data shape change`, both correct against the full diff: no route, no schema file,
no migration.

**`Swept` rows resolving to existing constraints** - carried from `8cf3461`; all four were re-read
there against code the fix did not touch (`req.appAuth!.role` at
`apps/api/src/modules/membership/membership.routes.ts:86,105,158`; zero `console.*` under
`apps/mobile`; both `/.well-known/*` handlers returning `404` while unset at
`apps/web/app/.well-known/apple-app-site-association/route.ts:18-20` and
`apps/web/app/.well-known/assetlinks.json/route.ts:19-21`; expo-router's two call sites at
`apps/mobile/node_modules/expo-router/build/getLinkingConfig.js:72,79` and
`build/link/linking.js:109,120`).

## Test policy rows

Rows 1 and 5 were the unmet ones and are **re-judged at `2bc2190`**. Rows 2, 3 and 4 classify files
the fix did not touch and are **carried from `8cf3461`**, with their proofs re-run in full this
round.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| 1 - Decides, in a pure module with no platform import | `apps/mobile/lib/invite-link.ts` (`parseInviteLink`, `extractLinkPath`, `isDownloadLink`), `packages/types/src/index.ts#resolvePapelToRole` | one at its own layer; one asserted case per decision row; every rejected input named as its own member | yes - re-judged at `2bc2190`. `isDownloadLink` now has C29 at its own layer over all 7 outcomes (`apps/mobile/lib/invite-link.test.ts:155-168`); the `decodeURIComponent` reject is named by C30 (`:142-145`); `resolvePapelToRole`'s `null` is named by C31 (`:30`). `extractLinkPath` stays met through `parseInviteLink` and `isDownloadLink` at the same module's own layer, which is the round-1 ruling the artifact's evidence list now records |
| 2 - An inbound-URL entry point a framework hook calls | `apps/mobile/app/+native-intent.ts` | one calling the exported function directly, under both `initial` values; one case per URL class x both; pass-through by string identity | yes - carried from `8cf3461`, proofs re-run: imported directly at `apps/mobile/app/+native-intent.test.ts:4`, both `initial` values over all 4 classes at `:64-80`, pass-through by `toBe(path)` at `:60` |
| 3 - Module-scoped mutable state another ticket inherits | `apps/mobile/lib/pending-invite.ts` | one per transition at its own layer; empty, written, overwritten, cleared | yes - carried from `8cf3461`, proofs re-run: `apps/mobile/lib/pending-invite.test.ts:22`, `:29-32`, `:36-38` |
| 4 - Native build configuration | `apps/mobile/app.json` | one over the config as the toolchain resolves it, never the raw bytes; every key under claim plus one key only the resolution produces | yes - carried from `8cf3461`, proofs re-run: assembly at `apps/mobile/link-config.test.ts:20-26`, claimed keys C1-C5, resolution-only keys at `:94-95` |
| 5 - Instrumentation (a re-export, a type alias, a forwarding wrapper) | `apps/web/lib/invite.ts#resolveInviteRole` only | none of its own, covered by its consumer's proof | yes - re-judged at `2bc2190`. The row's only remaining member is a literal re-export, `apps/web/lib/invite.ts:21`, covered by C26. `isDownloadLink` was moved out of this row and into row 1 by the fix, which is what round 1 asked for |

### The fix's own judgment calls, ruled on

**AC 26's second clause was dropped - sound, and it did not weaken an achievable obligation.**
The dropped clause ("no file under `apps/` SHALL contain the literal token `instrutor` paired with
`instructor`") is unsatisfiable, as round 1 showed: the assertions themselves must pair the tokens,
at `apps/mobile/lib/invite-link.test.ts:45` and `apps/web/lib/invite.test.ts:27`. The surviving
clause - "the `papel` -> role mapping table in exactly one module under `apps/` or `packages/`" -
is exactly what C25 proves, and its scope now matches C25's pathspec instead of being narrower than
it. Independently checked for drift that C25's single literal could miss: a `git grep -E` over
tracked sources under `apps` and `packages` for the mapping in any quoting form
(`instrutor["']?[[:space:]]*:[[:space:]]*["']instructor`, and the same for `responsavel`/`guardian`)
returns `packages/types/src/index.ts:31,32` and nothing else, so the surviving clause holds at
`HEAD` on its own terms and not only through the proxy. Residual, unchanged from round 1 and not a
gap: C25 is a literal grep, so a second table written as a `Map`, a `switch`, or with single quotes
would escape it - which is a known property of a grep check, recorded in the artifact's own prose.

**Declined sharpening 1, `expo prebuild` - conclusion stands, stated reason is wrong.** The decline
rests partly on "neither `.gitignore` covers `ios/` or `android/`, so a prebuild leaves untracked
native directories". That is false: the root `.gitignore:12-13` holds `apps/mobile/ios` and
`apps/mobile/android`, so a prebuild would leave *ignored*, not untracked, directories. The
conclusion survives anyway, on the ground round 1 itself gave: `Test policy` row 4 sets the bar at
"the config as the toolchain resolves it", C6 meets it, and the prebuild level was recorded as an
observation rather than an unmet row. Correcting the premise on the record; it is not a verdict
driver, and it never was.

**Declined sharpening 2, a `test` task in `packages/types` - holds.** C24 and C31 call
`resolvePapelToRole` directly through the package's public export, resolved from built `dist/` via
`exports.import`, which is its own layer; the package has no decision beyond a 3-row table behind
an exact-match guard. Round 1 recorded this as an observation with row 1 already satisfied, so
declining it changes nothing. The residual stands as a note: `packages/types/package.json` declares
no `test` script, so the shared module's proofs live in consumers' suites and depend on `pnpm build`
having run - which `turbo`'s `dependsOn: ["^build"]` arranges.

**Fidelity note kept.** `apps/mobile/vitest.config.ts:12` includes `"*.test.ts"` beyond door 4's
literal `include` shape. Additive, required for `link-config.test.ts` at the package root, and no
proof depends on the difference. Door 4's row is deliberately not rewritten.

**AC 6 - unchanged from round 1.** Enumerated, not blanket-exempted, and genuinely unprovable in
this repository: the project is managed (no `apps/mobile/ios`, no `apps/mobile/android`) and both
association routes answer `404` while `IOS_APP_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` are
unset. It remains a recorded precision gap and plan open question 1, `blocks go-live`.

## Faults injected

**Verified at `2bc2190`.** Scoped to the three assertion surfaces the fix created, each of which had
never been made to fail once. Isolated in `git worktree add <scratch> HEAD`; the real tree was never
mutated and `git stash` was never used. Real-tree `git status --porcelain` was **empty before and
empty after** - `verification.md` is committed at `2bc2190`, so a clean tree is genuinely empty -
and `HEAD` is still `2bc2190`. Scratch output lives outside the repository. To make the resolver
mutation live, the scratch's `apps/mobile/node_modules/@tatame/types` was pointed at the **scratch**
`packages/types` and rebuilt with `tsc`, rather than at the real tree's `dist/`; resolution was
confirmed with `readlink -f` before the run. Control run in the unmutated scratch: 27 passed (27).

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| R2-F1 drop the query-string strip - **this is round 1's surviving F5, re-run verbatim**: `extractLinkPath(url)?.replace(/\?.*$/, "") === "/baixar"` -> `extractLinkPath(url) === "/baixar"` | `apps/mobile/lib/invite-link.ts:111` | C29 `-t "tells the download page apart from everything else"` | yes - 1 failed, 11 skipped, failing at `apps/mobile/lib/invite-link.test.ts:157-158`, the query-string member itself. Whole suite: 1 failed, 26 passed. Round 1's survivor is dead |
| R2-F2 remove the `decodeURIComponent` try/catch, so the decode throws instead of returning `null` | `apps/mobile/lib/invite-link.ts:91-95` | C30 `-t "returns null when the academy segment cannot be decoded"` | yes - 1 failed, 11 skipped. Verbose whole-suite run shows **C30 as the only failure** out of 27, which independently confirms round 1's finding that no other check reached that catch |
| R2-F3 treat a `null` papel as the default token - the plausible "absent means aluno" bug: guard narrowed to `typeof papel !== "string" && papel !== null`, lookup to `PAPEL_TO_ROLE[papel ?? "aluno"]` | `packages/types/src/index.ts:48-49` (mutated in `src`, rebuilt to `dist` in the scratch) | C31 `-t "rejects a null papel"` | yes - 1 failed, 11 skipped. Verbose whole-suite run shows **C31 as the only failure** out of 27, so C31 is an independent regression guard and not a restatement of C24's `undefined` member |

Three faults on the three surfaces the fix created, each forcing a different proof to fail
(C29, C30, C31), and two of the three isolating their own check as the sole failure. The surfaces
round 1 already made to fail once - C1, C13, C19, C22 - are **carried from `8cf3461`**: the fix
changed none of the production code they cover, and re-mutating them would run the same experiment
twice.

## Remaining notes

None of these is an unproven coverage member, an unmet `Test policy` row, a failing check or a
surviving mutant. They are recorded so a later round does not rediscover them.

1. **AC 6 has no automated proof** - precision gap, ratified twice, blocked on plan open question 1.
   `apps/mobile/app.json:13-15,37-58` is the whole of what this repository controls.
2. **The `expo prebuild` level** - automatable (and the `.gitignore` objection to it is factually
   wrong, `.gitignore:12-13`), but above the bar `Test policy` row 4 sets, which C6 meets at
   `apps/mobile/link-config.test.ts:94-95`.
3. **`exp://…/--/baixar` is covered by composition, not named** - `isDownloadLink`'s row names 7
   members and the `exp://` form is not one of them; C12 proves the form reduces identically and the
   probe confirms the behaviour at `HEAD`. `apps/mobile/lib/invite-link.test.ts:155-168`.
4. **`academyId.length === 0` is unreachable** - `apps/mobile/lib/invite-link.ts:96`. After
   `filter((segment) => segment.length > 0)` at `:87`, no surviving segment can decode to the empty
   string, so this guard has no reachable member. Dead defensive code, not a coverage hole.
5. **`parseInviteLink`'s and `isDownloadLink`'s `null | undefined` signatures** -
   `apps/mobile/lib/invite-link.ts:76,110`, guarded at `:44`. Unreachable from production:
   expo-router tests the URL for truthiness first (`getLinkingConfig.js:71`) and the only call site
   passes `path: string`. Round 1 ranked this lowest for that reason; the resolver half of it is now
   closed by C31.
6. **`packages/types` has no `test` task** - the shared module's proofs live in consumers' suites.
7. **`apps/mobile` has no real `typecheck`** - `apps/mobile/package.json:9` is still
   `echo 'skipped: …'`, so nothing in CI typechecks the five mobile files this feature touches. Out
   of scope by the plan, and self-reported by the builder.
8. **C25 is a literal grep** - proven faithful at `HEAD` by an independent any-quoting-form search,
   but a mapping written as a `Map` or a `switch` would escape it.

## Gate

`pnpm turbo run test --force` - **930 passed, 0 failed** (8/8 tasks: `@tatame/api` 873 in 58 files
with Docker up, `@tatame/web` 30 in 10 files, `@tatame/mobile` 27 in 4 files).
`pnpm install --frozen-lockfile` - exit 0.
`bash -c 'pnpm build && pnpm --filter @tatame/web build && node scripts/assert-web-routes.mjs'` -
exit 0, 5 routes served.
`bash -c '[ "$(git grep -l ... -- apps packages | tr -d " ")" = "packages/types/src/index.ts" ]'` -
exit 0.
