# TAT-177 Universal Links verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: `origin/jeremiassnts3/tat-175-let-managers-invite-new-members-with-a-shareable-smart..HEAD` (`d7cb5a2`..`8cf3461`, 6 commits)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

All 28 checks run green with located assertions. The FAIL is carried by one surviving mutant,
three unproven coverage members and one unmet `Test policy` row - every one of them on code the
build wrote deliberately for a reachable input and then left unasserted.

## Binding sources

No binding sources. The plan marks none; `design.pen` carries no screen for this work and this
feature renders no UI (`Observable`: "this feature renders nothing"). Steps 1 and 5 do not apply.

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | resolved `ios.associatedDomains` array-equals `["applinks:apptatame.com.br"]` | mobile batch, `-t "claims the invite domain for iOS"` - ran, passed | `apps/mobile/link-config.test.ts:43` - `expect(resolved.ios?.associatedDomains).toEqual([\`applinks:${HOST}\`])` | PASS |
| C2 | exactly one `VIEW` + `autoVerify` filter, `category` has `BROWSABLE` and `DEFAULT` | mobile batch, `-t "declares one auto-verified browsable view filter"` - ran, passed | `apps/mobile/link-config.test.ts:50,56,57` - `expect(ours).toHaveLength(1)`; `expect(categories).toContain("BROWSABLE")`; `expect(categories).toContain("DEFAULT")` | PASS |
| C3 | that filter's `data` contains `{scheme:"https",host,pathPrefix:"/convite/"}` | mobile batch, `-t "claims every invite path on Android"` - ran, passed | `apps/mobile/link-config.test.ts:64` - `expect(data).toContainEqual({ scheme: "https", host: HOST, pathPrefix: "/convite/" })` | PASS |
| C4 | that filter's `data` contains `{scheme:"https",host,path:"/baixar"}` | mobile batch, `-t "claims the download page on Android"` - ran, passed | `apps/mobile/link-config.test.ts:75` - `expect(data).toContainEqual({ scheme: "https", host: HOST, path: "/baixar" })` | PASS |
| C5 | resolved `scheme` equals `tatame` | mobile batch, `-t "keeps the tatame scheme"` - ran, passed | `apps/mobile/link-config.test.ts:83` - `expect(resolved.scheme).toBe("tatame")` | PASS |
| C6 | the asserted object is `@expo/config`'s resolution, not `app.json`'s bytes | mobile batch, `-t "reads the config Expo resolves, not the file on disk"` - ran, passed | `apps/mobile/link-config.test.ts:94,95` - `expect(resolved.sdkVersion).toBe("57.0.0")`; `expect(resolved.ios?.infoPlist?.UILaunchStoryboardName).toBe("SplashScreen")`; assembly constructed at `apps/mobile/link-config.test.ts:20-26` (`execFileSync(node_modules/.bin/expo, ["config","--type","introspect","--json"])`, cwd = `apps/mobile`) | PASS |
| C7 | apex invite URL -> `{academyId, role:"student"}` | mobile batch, `-t "reads the academy and the suggested role out of an invite link"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:28-31` - `expect(parseInviteLink(\`${HOST}/convite/${ID}?papel=aluno\`)).toEqual({ academyId: ID, role: "student" })` | PASS |
| C8 | 3 tokens -> `student` / `instructor` / `guardian`, table-driven | mobile batch, `-t "maps each papel token to its role"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:36-38` table, asserted `:42-45` - `expect(parseInviteLink(...)).toEqual({ academyId: ID, role })` | PASS |
| C9 | 6 unusable `papel` inputs keep `academyId`, `role:null` | mobile batch, `-t "degrades an unusable papel to no suggested role"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:52-59` 6 members, asserted `:62-65` - `.toEqual({ academyId: ID, role: null })` | PASS |
| C10 | `/convite/a%20b` -> `academyId` `"a b"` | mobile batch, `-t "decodes the academy segment"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:70-73` - `expect(parseInviteLink(\`${HOST}/convite/a%20b\`)).toEqual({ academyId: "a b", role: null })` | PASS |
| C11 | 4 path shapes after `/convite` -> `null` | mobile batch, `-t "refuses a path that is not exactly one segment after convite"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:81` 4 members, asserted `:84` - `expect(parseInviteLink(\`${HOST}${path}\`)).toBeNull()` | PASS |
| C12 | 4 URL forms deep-equal **each other** | mobile batch, `-t "reads one invite the same way in every URL form"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:91-96` forms, asserted `:99-102` - `expect(results[0]).toEqual({ academyId: ID, role: "student" })` then `expect(result).toEqual(results[0])` | PASS |
| C13 | 4 wrong-host / wrong-path URLs -> `null` | mobile batch, `-t "accepts the apex host and that path only"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:109-114` 4 members, asserted `:117` - `expect(parseInviteLink(url)).toBeNull()` | PASS |
| C14 | 5 unparseable inputs -> `null`, no throw | mobile batch, `-t "returns null instead of throwing on an unparseable url"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:122-124` - `expect(() => parseInviteLink(url)).not.toThrow()`; `expect(parseInviteLink(url)).toBeNull()` over `["", "not a url", "://", "tatame://", "%"]` | PASS |
| C15 | invite -> `setPendingInvite` once with the parser's own output | mobile batch, `-t "hands the parsed invite to the pending-invite store"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:23,24` - `expect(readPendingInvite()).toEqual(parseInviteLink(INVITE))`; `expect(readPendingInvite()).toEqual({ academyId: ID, role: "instructor" })` | PASS |
| C16 | invite -> returns `"/"` | mobile batch, `-t "sends an invite to the app root"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:30` - `expect(redirectSystemPath({ path: INVITE, initial: true })).toBe("/")` | PASS |
| C17 | `https://apptatame.com.br/baixar` -> returns `"/"` | mobile batch, `-t "sends the download page to the app root"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:34` - `expect(redirectSystemPath({ path: DOWNLOAD, initial: false })).toBe("/")` (`DOWNLOAD` literal at `:8`) | PASS |
| C18 | a stored invite survives `/baixar`, `sso-callback`, unknown - 3 members | mobile batch, `-t "leaves a stored invite alone for every other url"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:38` 3 members, asserted `:42` - `expect(readPendingInvite()).toEqual(STORED)` | PASS |
| C19 | 5 other URLs returned by string identity | mobile batch, `-t "returns every other url untouched"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:51-57` 5 members, asserted `:60` - `expect(redirectSystemPath({ path, initial: false })).toBe(path)` | PASS |
| C20 | 4 URL classes x both `initial` values compared against each other | mobile batch, `-t "behaves the same on a cold start as on a resume"` - ran, passed | `apps/mobile/app/+native-intent.test.ts:77,78` - `expect(warm).toBe(cold)`; `expect(afterWarm).toEqual(afterCold)` over `[INVITE, DOWNLOAD, SSO, UNKNOWN]` (`:68`) | PASS |
| C21 | a freshly imported store answers `null` | mobile batch, `-t "holds nothing before an invite arrives"` - ran, passed | `apps/mobile/lib/pending-invite.test.ts:22` - `expect(fresh.readPendingInvite()).toBeNull()` after `vi.resetModules()` + re-import at `:20-21` | PASS |
| C22 | last write wins | mobile batch, `-t "keeps the most recent invite"` - ran, passed | `apps/mobile/lib/pending-invite.test.ts:31,32` - `expect(readPendingInvite()).toEqual(B)`; `expect(readPendingInvite()).not.toEqual(A)` | PASS |
| C23 | `clearPendingInvite` -> `null` | mobile batch, `-t "forgets the invite when cleared"` - ran, passed | `apps/mobile/lib/pending-invite.test.ts:38` - `expect(readPendingInvite()).toBeNull()` | PASS |
| C24 | `resolvePapelToRole` from `@tatame/types`: 3 tokens + 5 rejects | mobile batch, `-t "resolves the shared papel vocabulary and nothing outside it"` - ran, passed | `apps/mobile/lib/invite-link.test.ts:11-13` - `.toBe("student"/"instructor"/"guardian")`; `:18-22` - `.toBeNull()` for `"ALUNO"`, `" aluno"`, `""`, `undefined`, `["aluno"]` | PASS |
| C25 | exactly one file under `apps`+`packages` holds `instrutor: "instructor"`, and it is `packages/types/src/index.ts` | `bash -c '[ "$(git grep -l "instrutor: \"instructor\"" -- apps packages \| tr -d " ")" = "packages/types/src/index.ts" ]'` - exit 0 | the equality is the assertion; the grep returns exactly `packages/types/src/index.ts`, whose mapping is at `packages/types/src/index.ts:31` (`instrutor: "instructor"`). `PAPEL_TO_ROLE` is declared in one place only: `packages/types/src/index.ts:29` | PASS |
| C26 | `apps/web`'s `resolveInviteRole` unchanged behaviour through the shared module | `pnpm --filter @tatame/web exec vitest run lib/invite.test.ts -t "maps each papel token to its role\|degrades an unknown papel to no suggested role"` - both ran, passed (2 passed, 2 skipped) | `apps/web/lib/invite.test.ts:26-28` - `.toBe("student"/"instructor"/"guardian")`; `:34-38` - `.toBeNull()` for `undefined`, `""`, `"xyz"`, `"ALUNO"`, `"a".repeat(64)`. Subject changed in this diff: `apps/web/lib/invite.ts:21` is now `export const resolveInviteRole = resolvePapelToRole;` | PASS |
| C27 | after a real `next build`, the route manifest still holds every TAT-176 route | `bash -c 'pnpm build >/dev/null && pnpm --filter @tatame/web build >/dev/null && node scripts/assert-web-routes.mjs'` - exit 0, "5 route(s) served" | `scripts/assert-web-routes.mjs:33-39` required list, asserted `:54` - `REQUIRED.filter((route) => !served.has(route))` over `.next/app-path-routes-manifest.json` produced by the build | PASS |
| C28 | the committed lockfile matches both changed manifests | `pnpm install --frozen-lockfile` - exit 0, "Lockfile is up to date, resolution step is skipped" | pnpm's own manifest-vs-lockfile comparison; subjects `apps/mobile/package.json:13-14` (`"test": "vitest run"`, `"test:unit": "vitest run"`) and `apps/web/package.json:18` (`"@tatame/types": "workspace:*"`) | PASS |

Mobile batch = one invocation: `pnpm --filter @tatame/mobile exec vitest run link-config.test.ts
lib/invite-link.test.ts lib/pending-invite.test.ts "app/+native-intent.test.ts" --reporter=verbose
-t "<24-name alternation>"` - **24 passed (24), 4 files**, every named test shown individually in
the verbose output. Every name was located in the tree with `rg -n` before the run; none matched
nothing.

## Coverage

Recomputed from the authority over each set, not read back from `checks.md`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `papel` token vocabulary (4 classes) | `PAPEL_TO_ROLE` + the `?? null` fallthrough, `packages/types/src/index.ts:29-33,49` | `aluno` C8/C24 · `instrutor` C8/C24 · `responsavel` C8/C24 · else C9/C24 | - |
| `papel` unusable inputs (6) | the exact-match rule `packages/types/src/index.ts:49` + the array branch `apps/mobile/lib/invite-link.ts:105` | absent, `""`, `xyz`, `ALUNO`, `%20aluno`, repeated `papel` - all 6 at `apps/mobile/lib/invite-link.test.ts:52-59` | - |
| shared resolver non-string inputs (3) | the declared signature `packages/types/src/index.ts:46` (`string \| string[] \| null \| undefined`) + the `typeof` guard `:48` | `string[]` C24 (`:22`) · `undefined` C24 (`:21`) · `null` - none | `null` - declared and rejected, named nowhere |
| URL forms that must resolve to one invite (4) | `extractLinkPath`'s 4 branches, `apps/mobile/lib/invite-link.ts:45,47-48,57-62,64-65` | `https` apex C7/C12 · `tatame:///` C12 · `exp://…/--/` C12 · bare path C12 - all 4 branches reached | - |
| URL forms refused by host and path (4) | host exact-match `apps/mobile/lib/invite-link.ts:60` + `INVITE_SEGMENT` guard `:88` | `example.com` · `www.` · `apptatame.com.br.evil.com` · apex non-invite path - all C13 (`:109-114`) | - |
| invite path shapes refused (4) | `segments.length !== 2`, `apps/mobile/lib/invite-link.ts:88` | `/convite/` · `/convite` · `/convite//` · `/convite/<id>/extra` - all C11 (`:81`) | - |
| inputs `parseInviteLink` must reject without throwing (2 throw sites) | the two `try/catch` sites, `apps/mobile/lib/invite-link.ts:51-55` and `:91-95` | `new URL` throw C14 (4 of its 5 members) · `decodeURIComponent` throw - none | `/convite/%` - the `decodeURIComponent` catch at `apps/mobile/lib/invite-link.ts:91-95` is reached by no named member |
| `redirectSystemPath` URL classes (4) | the 3 outcomes in `apps/mobile/app/+native-intent.ts:31-44`, with the `/baixar` class recomputed from `isDownloadLink` (`apps/mobile/lib/invite-link.ts:111`) | invite C15/C16/C20 · `/baixar` bare C17/C18/C20 · `sso-callback` C18/C19/C20 · unknown C18/C19/C20 | `/baixar` **with a query string** - the `.replace(/\?.*$/, "")` member of the class; see fault F5 |
| `initial` values (2) | the destructured parameter `apps/mobile/app/+native-intent.ts:20-30` (unused by design) | `true` and `false` compared against each other over all 4 classes, C20 (`apps/mobile/app/+native-intent.test.ts:68-78`) | - |
| pending-invite store states (4) | the single `let` and its 3 writers, `apps/mobile/lib/pending-invite.ts:18,25-35` | empty C21 · written C15/C22 · overwritten C22 · cleared C23 | - |
| `app.json` link claim, per platform (2) | `apps/mobile/app.json:13-15` (iOS) and `:37-58` (Android) | iOS C1/C6 · Android C2/C3/C4/C6 | - |
| Android `data` items the claim needs (2) | `apps/mobile/app.json:46-55` | `pathPrefix: "/convite/"` C3 · `path: "/baixar"` C4 | - |
| Android filter attributes the OS requires (4) | `apps/mobile/app.json:39-44` | `action: VIEW`, `autoVerify: true`, `BROWSABLE`, `DEFAULT` - all C2 (`apps/mobile/link-config.test.ts:50-57`) | - |
| one-way doors (5) | plan `Landing` rows 1-5 | door 1 C1-C6 · door 2 C15-C20 (`+native-intent.ts` exports `redirectSystemPath`, pure, no `expo-linking` import) · door 3 C15/C21/C22/C23 (all three signatures exercised) · door 4 the runner itself, `apps/mobile/vitest.config.ts` · door 5 C24-C27 | - |
| startup config: the Expo config resolution (1 assembly) | read directly: the assembly is constructed at `apps/mobile/link-config.test.ts:20-26`, `execFileSync(.../expo, ["config","--type","introspect","--json"])` with `cwd` = `apps/mobile`, so it resolves this tree's `app.json` through the real `@expo/config` | C1-C6, with C6 (`:94-95`) as the negative control proving it is the resolution and not a byte read | - |
| startup config: `apps/web`'s dependency graph (3 assemblies) | read directly: `next build` (manifest at `apps/web/.next/app-path-routes-manifest.json`, consumed by `scripts/assert-web-routes.mjs:28-31`); `apps/web` vitest; `pnpm install --frozen-lockfile` | real build C27 (ran, 5 routes served) · vitest C26 (ran, 2 passed) · clean install C28 (ran, exit 0) | - |

Swept for sets neither artifact gave a row: plan `Surface` is `None - nothing consumed outside`
(no route, no status codes, nothing to enumerate) and `Relations` is `None - no stored-data shape
change`, both correct against the diff - no migration, no schema file touched. One set has no row
at all: **`isDownloadLink`'s own outcome classes**. It is folded into the `redirectSystemPath`
`/baixar` row above, where its unproven member is recorded.

`Swept` rows resolving to **existing** constraints, re-read against the code - all four hold:

- authorization `n/a`, citing `req.appAuth!.role`: present at `apps/api/src/modules/membership/membership.routes.ts:86,105,158`
- observability `n/a`, citing zero `console.*` in `apps/mobile`: `rg -c "console\.(log|warn|error|info|debug)" apps/mobile --glob '!node_modules'` returns nothing
- dependency failure, citing both `/.well-known/*` answering `404` while unset: `apps/web/app/.well-known/apple-app-site-association/route.ts:18-20` and `apps/web/app/.well-known/assetlinks.json/route.ts:19-21`
- concurrency, citing expo-router's two call sites: `apps/mobile/node_modules/expo-router/build/getLinkingConfig.js:72,79` (`initial: true`) and `build/link/linking.js:109,120` (`initial: false`). `getLinkingConfig.js:71` guards on a truthy URL, so `redirectSystemPath` never receives a falsy path in production - this is why gap 3 is ranked lowest

## Test policy rows

`checks.md` carries 5 rows (`AGENTS.md` has none - confirmed, `rg "Test policy" AGENTS.md`
returns nothing), so these rows are the bar, not the repo's conventions.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| 1 - Decides, in a pure module with no platform import | `apps/mobile/lib/invite-link.ts` (`parseInviteLink`, `extractLinkPath`, **`isDownloadLink`**), `packages/types/src/index.ts#resolvePapelToRole` | one at its own layer; one asserted case per decision row; **every rejected input named as its own member** | **no** - `isDownloadLink` (`apps/mobile/lib/invite-link.ts:110-111`) decides and has no own-layer proof at all; `parseInviteLink`'s `decodeURIComponent` reject (`:91-95`) is named by no member; `resolvePapelToRole`'s `null` reject is named by no member |
| 2 - An inbound-URL entry point a framework hook calls | `apps/mobile/app/+native-intent.ts` | one calling the exported function directly, under both `initial` values; one case per URL class x both; pass-through by string identity | yes - imported directly at `apps/mobile/app/+native-intent.test.ts:4` and called at `:20,30,34,41,60,70,74`; both `initial` values over all 4 classes at `:64-80`; pass-through by `toBe(path)` at `:60` |
| 3 - Module-scoped mutable state another ticket inherits | `apps/mobile/lib/pending-invite.ts` | one per transition at its own layer; empty, written, overwritten, cleared | yes - `apps/mobile/lib/pending-invite.test.ts:22` (empty, fresh module), `:29-32` (written + overwritten), `:36-38` (cleared) |
| 4 - Native build configuration | `apps/mobile/app.json` | one over the config as the toolchain resolves it, never the raw bytes; every key under claim plus one key only the resolution produces | yes - assembly at `apps/mobile/link-config.test.ts:20-26`; every claimed key C1-C5; resolution-only keys at `:94-95` |
| 5 - Instrumentation (a re-export, a type alias, a forwarding wrapper) | per the artifact's own Evidence: `apps/web/lib/invite.ts#resolveInviteRole`; the builder's close adds `isDownloadLink` | none of its own, covered by its consumer's proof | **no as applied** - correct for `apps/web/lib/invite.ts:21` (`export const resolveInviteRole = resolvePapelToRole;` is a literal re-export, covered by C26). Wrong for `isDownloadLink`: it is not a re-export, alias or forwarding wrapper - it composes `extractLinkPath`, strips a query string and compares, i.e. it decides, so row 1 governs it |

### The three judgment calls the builder flagged, contested

**1. AC 6 has no automated proof - ratified as a precision gap, with one sharpening.** The
exemption enumerates rather than blanket-exempting: it names the criterion, the two unset env
vars and what would settle it. Independently confirmed - the project is managed (no
`apps/mobile/ios`, no `apps/mobile/android`), and both association routes return `404` while
`IOS_APP_ID` / `ANDROID_SHA256_CERT_FINGERPRINTS` are unset
(`apps/web/app/.well-known/apple-app-site-association/route.ts:18-20`,
`apps/web/app/.well-known/assetlinks.json/route.ts:19-21`), so no assertion in this repository can
reach the tap. **Sharpening:** C1-C6 stop at `@expo/config`'s resolution, and the prebuild *mod*
phase that turns `associatedDomains` into `Tatame.entitlements` and `intentFilters` into
`AndroidManifest.xml` sits between the proven object and the binary. The plan's own Independent
test names `npx expo prebuild` + a manifest read as the automatable step at that level, and it was
not taken. This is an observation, not an unmet row: `Test policy` row 4 - approved - sets the bar
at "the config as the toolchain resolves it", and C1-C6 meet it exactly.

**2. C25's `-- apps packages` pathspec - a correction, not a weakening.** Proven at `HEAD`:
`git grep -l 'instrutor: "instructor"'` with no pathspec returns **two** paths,
`.specs/features/tat-177-universal-links/checks.md` and `packages/types/src/index.ts`, so the
equality could never hold - the command as first written could not pass against any
implementation. The pathspec restores runnability without narrowing the claim, whose own text is
scoped to `apps/` and `packages/` and which is a superset of AC 26's `apps/` scope. Residual, and
recorded as gap 4 rather than against C25: AC 26's literal text ("no file under `apps/` SHALL
contain the literal token `instrutor` paired with `instructor`") is unsatisfiable as written,
because the assertions themselves must pair them -
`apps/mobile/lib/invite-link.test.ts:37` (`["instrutor", "instructor"]`) and
`apps/web/lib/invite.test.ts:27`. C25 proves the AC's intent (one mapping module), not its letter.

**3. `isDownloadLink` classified as instrumentation - ruled against the builder.** See gap 1. Row
5 covers "a re-export, a type alias, a forwarding wrapper"; this is none of the three. Its body,
`extractLinkPath(url)?.replace(/\?.*$/, "") === "/baixar"`, has three outcomes and a deliberate
query-string strip, so row 1 governs it and demands a proof at its own layer with each rejected
input named. It has no own-layer proof - `rg -n "isDownloadLink"` finds exactly two references,
its declaration at `apps/mobile/lib/invite-link.ts:110` and its single call site at
`apps/mobile/app/+native-intent.ts:42`, and no test file at all. Fault F5 turns the classification
into a measurement.

**4. `extractLinkPath` - ruled for the builder.** It is non-exported, in the same pure module as
`parseInviteLink`, so a proof calling `parseInviteLink` is a proof at that module's own layer; row
1 constrains the layer, not the export granularity. All four URL-form branches
(`apps/mobile/lib/invite-link.ts:45,47-48,57-62,64-65`) are reached by named members of enumerated
sets - C12 for the four forms, C13 for the host exact-match and its `null` return, C14 for the
`new URL` catch. Faults F2 and F3 confirm two of those branches are genuinely load-bearing for a
proof. No separate own-layer proof is owed.

## Faults injected

Isolated in `git worktree add <scratch> HEAD` with `node_modules` symlinked from the real tree;
the real tree was never mutated and `git stash` was never used. Real-tree
`git status --porcelain` was empty before and empty after, and `HEAD` is still `8cf3461` - they
match. Scratch output lives outside the repository, so no untracked file was created in it.
Control run in the unmutated scratch: 24 passed (24).

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| F1 `"applinks:apptatame.com.br"` -> `"applinks:www.apptatame.com.br"` | `apps/mobile/app.json:14` | C1 `-t "claims the invite domain for iOS"` | yes - 1 failed, 5 skipped |
| F2 host exact-match -> suffix match: `parsed.hostname !== HOST` -> `!parsed.hostname.endsWith(HOST)` | `apps/mobile/lib/invite-link.ts:60` | C13 `-t "accepts the apex host and that path only"` | yes - 1 failed, 8 skipped |
| F3 pass-through `return path;` -> `return "/";` | `apps/mobile/app/+native-intent.ts:44` | C19 `-t "returns every other url untouched"` | yes - 1 failed, 5 skipped |
| F4 last-write-wins -> first-write-wins: `pending = invite;` -> `if (pending === null) pending = invite;` | `apps/mobile/lib/pending-invite.ts:26` | C22 `-t "keeps the most recent invite"` | yes - 1 failed, 2 skipped |
| F5 drop the query-string strip: `extractLinkPath(url)?.replace(/\?.*$/, "") === "/baixar"` -> `extractLinkPath(url) === "/baixar"` | `apps/mobile/lib/invite-link.ts:111` | C17 + C18 (the `/baixar` class); whole mobile suite run to give every proof a chance | **no - survived**: 24 passed (24) |

Five faults on five distinct assertion surfaces, forcing five different proofs (C1, C13, C19, C22,
C17/C18) across four test files. Budget reached at five.

F5 is not a theoretical survivor. In the same scratch tree, at `HEAD`,
`isDownloadLink("https://apptatame.com.br/baixar?utm_source=whatsapp")` is `true` and
`redirectSystemPath({ path: that, initial: true })` returns `"/"`; under the mutant the same call
returns the URL unchanged - a different, user-visible outcome that the whole suite accepts. The
input class is reachable: Android's `path: "/baixar"` filter (`apps/mobile/app.json:51-55`) and
iOS's `/baixar` AASA component
(`apps/web/app/.well-known/apple-app-site-association/route.ts:29`) both match on path alone, so a
shared download link carrying `?utm_source=…` is delivered to the app.

## Ranked gaps

1. **Surviving mutant / unproven coverage member - `isDownloadLink`'s query-string strip.**
   `apps/mobile/lib/invite-link.ts:111`. No test imports the function; `/baixar` appears as test
   input exactly once, bare, at `apps/mobile/app/+native-intent.test.ts:8`, and
   `rg -n "baixar\?"` across the repo returns nothing. `Test policy` rows 1 and 5 both land on it.
   Fix shape: one own-layer test for `isDownloadLink` naming its members - bare `/baixar`,
   `/baixar?utm_source=x`, `tatame:///baixar`, `exp://…/--/baixar`, a non-`/baixar` path, and a
   wrong host.
2. **Unproven coverage member - the `decodeURIComponent` reject in `parseInviteLink`.**
   `apps/mobile/lib/invite-link.ts:91-95`. No named member reaches the catch: of C14's five
   inputs, four throw earlier in `new URL` (`:51-55`) and `"tatame://"` resolves to path `""` and
   is rejected by the segment-length guard at `:88`. The reachable input is
   `https://apptatame.com.br/convite/%` - verified with node that `new URL` accepts it with
   `pathname === "/convite/%"` and that `decodeURIComponent("%")` throws `URIError`, so this
   `try/catch` is the only thing keeping `parseInviteLink` from throwing, and Android's
   `pathPrefix: "/convite/"` delivers it. No mutation run (fault budget reached); established by
   enumerating C14's members against the code path. Fix shape: add `/convite/%` to C14's table.
3. **Unproven coverage member - `null` as a non-string input to `resolvePapelToRole`.**
   `packages/types/src/index.ts:46-49`. The signature declares it and the `typeof` guard rejects
   it; it is named nowhere. Lowest severity by two measures: behaviourally identical to
   `undefined`, which is proven at `apps/mobile/lib/invite-link.test.ts:21`, and unreachable from
   either consumer - `apps/web` passes Next `searchParams` values and `apps/mobile` passes a
   `string` (`apps/mobile/app/+native-intent.ts:31`). The same shape applies to
   `parseInviteLink`'s own `null | undefined` signature
   (`apps/mobile/lib/invite-link.ts:76`, guarded at `:44`), which expo-router cannot produce
   because `getLinkingConfig.js:71` tests the URL for truthiness first. Fix shape: one more member,
   or narrow the signatures to `string`.
4. **Precision gap - AC 26's letter vs C25's literal.** AC 26 forbids any file under `apps/`
   pairing `instrutor` with `instructor`; `apps/mobile/lib/invite-link.test.ts:37` and
   `apps/web/lib/invite.test.ts:27` do exactly that, as assertions. C25 proves the intent, so the
   gap is in the criterion's wording, not in the code or the check.
5. **Precision gap - AC 6, with a level observation.** Recorded correctly and enumerated, but the
   `expo prebuild` + `AndroidManifest.xml` / `Tatame.entitlements` level named in the plan's own
   Independent test was automatable and not taken. `Test policy` row 4 is met regardless.
6. **Fidelity note - door 4's literal shape.** Plan door 4 fixes
   `test.include: ["{app,lib}/**/*.test.ts"]`; `apps/mobile/vitest.config.ts:12` is
   `["{app,lib}/**/*.test.ts", "*.test.ts"]`. Additive, and required for `link-config.test.ts` at
   the package root to run at all; no proof depends on the difference.
7. **Observation - `packages/types` has no test task.** `packages/types/package.json` declares no
   `test` script and the package holds no test file, so `resolvePapelToRole`'s only proofs live in
   `apps/mobile`'s (C24) and `apps/web`'s (C26) suites. Row 1's "own layer" is satisfied - the
   exported function is called directly through the built package - but the shared module has no
   guard of its own.

Also confirmed, and already self-reported by the builder: `apps/mobile`'s `typecheck` is still the
stub `echo 'skipped: …'` (`apps/mobile/package.json:9`), so nothing in CI typechecks the four new
files. The plan puts that out of scope.

## Gate

`pnpm turbo run test --force` - 927 passed, 0 failed (8/8 tasks: `@tatame/api` 873 in 58 files
with Docker up, `@tatame/web` 30 in 10 files, `@tatame/mobile` 24 in 4 files).
`pnpm install --frozen-lockfile` - exit 0.
`bash -c 'pnpm build && pnpm --filter @tatame/web build && node scripts/assert-web-routes.mjs'` -
exit 0, 5 routes served.
