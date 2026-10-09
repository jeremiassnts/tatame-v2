# TAT-177 — Universal Links and App Links — checks

Profile: standard
Plan: `.specs/features/tat-177-universal-links/plan.md`

28 checks in 4 slices · 5 one-way doors · 2 open, of which 0 block

Every proof runs from the repository root. `pnpm install` first, then `pnpm build` — `@tatame/types`
resolves through `exports.import` to `dist/`, so both `apps/mobile`'s and `apps/web`'s tests read
the built package, not its source.

Four proof mechanics were spiked before being written down, rather than assumed:

- `pnpm --filter @tatame/mobile exec vitest run <file> -t "<name>"` runs with
  `environment: "node"` and the `@` alias mirroring `tsconfig.json`'s `paths`. Confirmed green
  against a throwaway test importing `@tatame/types`, `@/lib/belts` and `app.json`.
- `execFileSync("npx", ["expo", "config", "--type", "introspect", "--json"])` from inside a
  vitest file returns the config **as `@expo/config` resolves it** — plugin-contributed
  `ios.infoPlist` keys and `sdkVersion` included — in 0.65s measured. That is a level above
  reading `app.json`'s bytes, and C6 is the negative control that keeps the two distinguishable.
- `apps/web` consumes `@tatame/types` through a real `next build` with **no**
  `transpilePackages` entry: 18 routes built, confirmed green. The plan's assumption about that
  flag is therefore closed as "not needed".
- Adding the two manifest entries churns 341 lines of `pnpm-lock.yaml` — pnpm re-resolving the
  `react-native` peer chain, not a version change. Verified idempotent across two installs and
  verified `pnpm install --frozen-lockfile` passes afterwards, which is what C28 asserts.

## Checks

### S1 — the OS hands invite links to the app · 2 existing files, 1 new · 5 KB · ~1k

**C1** - the resolved Expo config's `ios.associatedDomains`, compared by array equality against `["applinks:apptatame.com.br"]`, is exactly that — so a removed entry and an added one both fail (AC 1)
Proof: `pnpm --filter @tatame/mobile exec vitest run link-config.test.ts -t "claims the invite domain for iOS"`

**C2** - exactly one `android.intentFilters` entry has `action: "VIEW"` and `autoVerify: true`, and that entry's `category` contains both `BROWSABLE` and `DEFAULT` (AC 2)
Proof: `pnpm --filter @tatame/mobile exec vitest run link-config.test.ts -t "declares one auto-verified browsable view filter"`

**C3** - that entry's `data` carries an item deep-equal to `{ scheme: "https", host: "apptatame.com.br", pathPrefix: "/convite/" }` (AC 3)
Proof: `pnpm --filter @tatame/mobile exec vitest run link-config.test.ts -t "claims every invite path on Android"`

**C4** - that entry's `data` carries an item deep-equal to `{ scheme: "https", host: "apptatame.com.br", path: "/baixar" }` (AC 4)
Proof: `pnpm --filter @tatame/mobile exec vitest run link-config.test.ts -t "claims the download page on Android"`

**C5** - the resolved config's `scheme` equals `tatame`, so the `Linking.createURL` the SSO flow builds keeps the prefix it has today (AC 5)
Proof: `pnpm --filter @tatame/mobile exec vitest run link-config.test.ts -t "keeps the tatame scheme"`

**C6** - the object C1-C5 assert against is `@expo/config`'s resolution and not a raw read of `app.json`: the same object carries `sdkVersion` equal to `"57.0.0"` and `ios.infoPlist.UILaunchStoryboardName` equal to `"SplashScreen"`, neither of which appears anywhere in `app.json` (AC 1, AC 2, AC 3, AC 4, AC 5)
Proof: `pnpm --filter @tatame/mobile exec vitest run link-config.test.ts -t "reads the config Expo resolves, not the file on disk"`

> **AC 6 — the tap opening the app on a real device — has no automated proof and is not
> claimed by any check.** `app.json` is the whole of what this repository controls; whether
> Apple and Google then verify the domain depends on `IOS_APP_ID` and
> `ANDROID_SHA256_CERT_FINGERPRINTS`, which are unset, so both `/.well-known/*` routes answer
> `404` and neither OS can verify anything today. C1-C6 prove the claim is declared correctly
> and at the right level; the tap itself is plan open question 1, `blocks go-live`, and the
> maintainer's EAS `preview` build is the only thing that can settle it. Recorded as a precision
> gap rather than closed.

### S2 — an invite URL becomes an academy id and a suggested role · 2 new files · 7 KB · ~2k

**C7** - `parseInviteLink("https://apptatame.com.br/convite/<uuid>?papel=aluno")` returns `{ academyId: "<uuid>", role: "student" }` (AC 7)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-link.test.ts -t "reads the academy and the suggested role out of an invite link"`

**C8** - `papel=aluno`, `papel=instrutor` and `papel=responsavel` yield `role` `"student"`, `"instructor"` and `"guardian"` — table-driven over all 3 (AC 8, AC 9)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-link.test.ts -t "maps each papel token to its role"`

**C9** - `papel` absent, `papel=`, `papel=xyz`, `papel=ALUNO`, `papel=%20aluno` and `papel=aluno&papel=instrutor` each return the same `academyId` with `role: null` — 6 members, table-driven (AC 10)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-link.test.ts -t "degrades an unusable papel to no suggested role"`

**C10** - `/convite/a%20b` returns `academyId` equal to `"a b"`, so the segment is URL-decoded rather than passed through (AC 11)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-link.test.ts -t "decodes the academy segment"`

**C11** - `/convite/`, `/convite`, `/convite//` and `/convite/<uuid>/extra` each return `null` — 4 members, table-driven (AC 12)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-link.test.ts -t "refuses a path that is not exactly one segment after convite"`

**C12** - the four URL forms of one invite — `https://apptatame.com.br/convite/<uuid>?papel=aluno`, `tatame:///convite/<uuid>?papel=aluno`, `exp://192.168.0.2:8081/--/convite/<uuid>?papel=aluno` and `/convite/<uuid>?papel=aluno` — return results deep-equal **to each other**, so a form that drifts fails even if the literal it was compared against drifted with it. 4 members, table-driven (AC 13)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-link.test.ts -t "reads one invite the same way in every URL form"`

**C13** - `https://example.com/convite/<uuid>`, `https://www.apptatame.com.br/convite/<uuid>`, `https://apptatame.com.br.evil.com/convite/<uuid>` and `https://apptatame.com.br/outro/<uuid>` each return `null` — 4 members, table-driven (AC 14)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-link.test.ts -t "accepts the apex host and that path only"`

**C14** - `""`, `"not a url"`, `"://"`, `"tatame://"` and `"%"` each return `null` and the call does not throw — 5 members, table-driven (AC 15)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-link.test.ts -t "returns null instead of throwing on an unparseable url"`

> `http://apptatame.com.br/convite/<uuid>` is deliberately **accepted**, not rejected: the host is
> the one this app claims, and AC 14 is about the host rather than the scheme. No operating system
> can deliver an `http` link for a domain whose association files are only reachable over `https`,
> so a scheme branch here would be code nothing can exercise — the same reason the plan gives for
> not accepting `www.`.

### S3 — the invite is handed on and the app opens at its root · 3 new files · 8 KB · ~2k

**C15** - given an invite link, `redirectSystemPath` calls `setPendingInvite` exactly once, with the object `parseInviteLink` returns for the same URL (AC 16)
Proof: `pnpm --filter @tatame/mobile exec vitest run "app/+native-intent.test.ts" -t "hands the parsed invite to the pending-invite store"`

**C16** - given an invite link, `redirectSystemPath` returns `"/"` (AC 17)
Proof: `pnpm --filter @tatame/mobile exec vitest run "app/+native-intent.test.ts" -t "sends an invite to the app root"`

**C17** - given `https://apptatame.com.br/baixar`, `redirectSystemPath` returns `"/"` (AC 18)
Proof: `pnpm --filter @tatame/mobile exec vitest run "app/+native-intent.test.ts" -t "sends the download page to the app root"`

**C18** - with an invite already stored, `redirectSystemPath` on `https://apptatame.com.br/baixar`, on `tatame:///sso-callback` and on `/alguma-coisa` each leave `readPendingInvite` deep-equal to that stored invite — 3 members (AC 19)
Proof: `pnpm --filter @tatame/mobile exec vitest run "app/+native-intent.test.ts" -t "leaves a stored invite alone for every other url"`

**C19** - `redirectSystemPath` returns the input string itself, asserted with `toBe`, for `tatame:///sso-callback`, `https://apptatame.com.br/`, `https://apptatame.com.br/conta`, `/sso-callback` and `exp://192.168.0.2:8081/--/` — 5 members, table-driven (AC 20)
Proof: `pnpm --filter @tatame/mobile exec vitest run "app/+native-intent.test.ts" -t "returns every other url untouched"`

**C20** - for each of the 4 URL classes — invite, `/baixar`, `sso-callback`, unknown — `redirectSystemPath` returns the same value and leaves the same pending invite with `initial: true` as with `initial: false` — 4 × 2, table-driven, comparing the two runs against each other (AC 21)
Proof: `pnpm --filter @tatame/mobile exec vitest run "app/+native-intent.test.ts" -t "behaves the same on a cold start as on a resume"`

**C21** - `readPendingInvite()` returns `null` in a freshly imported module, with no prior `setPendingInvite` (AC 22)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "holds nothing before an invite arrives"`

**C22** - after `setPendingInvite(a)` then `setPendingInvite(b)`, `readPendingInvite()` is deep-equal to `b` and not to `a` (AC 23)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "keeps the most recent invite"`

**C23** - after `clearPendingInvite()`, `readPendingInvite()` returns `null` (AC 24)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/pending-invite.test.ts -t "forgets the invite when cleared"`

### S4 — one definition of the `papel` vocabulary · 4 existing files, 0 new · 10 KB · ~2k

**C24** - `resolvePapelToRole` from `@tatame/types` returns `"student"` for `aluno`, `"instructor"` for `instrutor`, `"guardian"` for `responsavel`, and `null` for `"ALUNO"`, `" aluno"`, `""`, `undefined` and `["aluno"]` — 8 members, table-driven (AC 25)
Proof: `pnpm --filter @tatame/mobile exec vitest run lib/invite-link.test.ts -t "resolves the shared papel vocabulary and nothing outside it"`

**C25** - exactly one file in the repository contains the literal `instrutor: "instructor"`, and it is `packages/types/src/index.ts` (AC 26)
Proof: `bash -c '[ "$(git grep -l "instrutor: \"instructor\"" | tr -d " ")" = "packages/types/src/index.ts" ]'`

**C26** - `apps/web`'s `resolveInviteRole` still maps the three tokens and still returns `null` for `undefined`, `""`, `"xyz"`, `"ALUNO"` and a 64-character string, now resolving through the shared module — TAT-176's own C17 and C18, re-run against the replaced implementation (AC 27)
Proof: `pnpm --filter @tatame/web exec vitest run lib/invite.test.ts -t "maps each papel token to its role"`
Proof: `pnpm --filter @tatame/web exec vitest run lib/invite.test.ts -t "degrades an unknown papel to no suggested role"`

**C27** - after a real `next build` with `apps/web` resolving `@tatame/types`, `.next/app-path-routes-manifest.json` still holds every route TAT-176 required — so the first workspace dependency in this Next app does not cost a route (AC 27)
Proof: `bash -c 'pnpm build >/dev/null && pnpm --filter @tatame/web build >/dev/null && node scripts/assert-web-routes.mjs'`

**C28** - `pnpm install --frozen-lockfile` exits 0, so the committed `pnpm-lock.yaml` matches the two manifests this ticket changes (AC 26, AC 27)
Proof: `pnpm install --frozen-lockfile`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `papel` token vocabulary (4 classes) | `aluno` C8, C24 · `instrutor` C8, C24 · `responsavel` C8, C24 · anything else C9, C24 | - |
| `papel` unusable inputs (6) | absent C9 · `""` C9 · `xyz` C9 · `ALUNO` C9, C24 · `%20aluno` C9 · repeated `papel` C9 | - |
| shared resolver non-string inputs (3) | `undefined` C24 · `" aluno"` C24 · `["aluno"]` C24 | - |
| URL forms that must resolve to one invite (4) | `https` apex C7, C12 · `tatame:///` C12 · `exp://…/--/` C12 · bare path C12 | - |
| URL forms the parser must refuse, by host and path (4) | `example.com` C13 · `www.apptatame.com.br` C13 · `apptatame.com.br.evil.com` C13 · apex with a non-invite path C13 | - |
| invite path shapes refused (4) | `/convite/` C11 · `/convite` C11 · `/convite//` C11 · `/convite/<id>/extra` C11 | - |
| unparseable inputs (5) | `""` C14 · `not a url` C14 · `://` C14 · `tatame://` C14 · `%` C14 | - |
| `redirectSystemPath` URL classes (4) | invite C15, C16, C20 · `/baixar` C17, C18, C20 · `sso-callback` C18, C19, C20 · unknown C18, C19, C20 | - |
| `initial` values (2) | `true` C20 · `false` C20 — table-driven over all 4 URL classes × both | - |
| pending-invite store states (4) | empty C21 · written C15, C22 · overwritten C22 · cleared C23 | - |
| `app.json` link claim, per platform (2) | iOS `associatedDomains` C1, C6 · Android `intentFilters` C2, C3, C4, C6 | - |
| Android `data` items the claim needs (2) | `/convite/` by prefix C3 · `/baixar` exactly C4 | - |
| Android filter attributes the OS requires (4) | `action: VIEW` C2 · `autoVerify: true` C2 · `category: BROWSABLE` C2 · `category: DEFAULT` C2 | - |
| one-way doors (5) | door 1 C1-C6 · door 2 C15-C20 · door 3 C15, C21, C22, C23 · door 4 C1-C24, every mobile proof exists only because the runner does · door 5 C24, C25, C26, C27 | - |
| startup config: the Expo config resolution (1 assembly) | `expo config --type introspect` C1-C6 — collapsed deliberately: `eas build` and `expo prebuild` both resolve the config through the same `@expo/config`, so there is one assembly, and C6 is what proves the proof reached it rather than reading the file | - |
| startup config: `apps/web`'s dependency graph (3 assemblies) | real `next build` C27 · `apps/web` vitest C26 · a clean install from the committed lockfile C28 | - |

- `validate_checks.py` warns that C25 and C28 name no test selector. Both are one-shot commands
  settling exactly one claim and nothing else, the same shape TAT-176 used for its C12: C25 is a
  `git grep -l` equality against one path and fails the moment a second file spells the mapping,
  and C28 is pnpm's own lockfile-vs-manifest comparison, which no test running inside the bundle
  can perform. Left as commands on purpose
- Claims naming a config key, a URL or a returned string: C1-C6, C12, C13, C19, C25, C27 — each has a proof that crosses the boundary it claims. C1-C6 assert the config as `@expo/config` resolves it rather than as `app.json` spells it; C19 asserts string identity with `toBe`, not shape; C27 asserts a manifest a real `next build` produced
- AC 6 is the one acceptance criterion with no check at all, by the note under S1. Everything else in the plan's 27 criteria carries one
- C12 and C20 both prove their set by comparing members **against each other** rather than against a literal, so a drift that moves every member together still fails
- No other check claims more than the single case its proof exercises

## Test policy

`AGENTS.md` on this branch has no `### Test policy` section — `git grep` finds none — and
nothing in it says which level proves a given shape of code or how much of an input space a
proof must assert. TAT-176's `checks.md` proposed four rows for `apps/web` and asked the same
narrow question; they were never written into `AGENTS.md`, so both questions are still open for
`apps/web` and have never been asked for `apps/mobile`, which has no test runner at all before
this ticket. `docs/superpowers/specs/2026-03-20-api-testing-design.md` settles where API tests
live and how they are built, not either question.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, in a pure module with no platform import | one at its own layer | one asserted case per row of the decision table, and every rejected input named as its own member |
| An inbound-URL entry point a framework hook calls | one calling the exported function directly, under both `initial` values | one case per URL class × both `initial` values; the pass-through class asserted by string identity, never by shape |
| Module-scoped mutable state another ticket inherits | one per transition at its own layer | empty, written, overwritten, cleared |
| Native build configuration | one over the config as the toolchain resolves it, never over the raw manifest bytes | every key under claim, plus one key only the resolution produces, so a raw read and a resolution stay distinguishable |
| Instrumentation — a re-export, a type alias, a forwarding wrapper | none of its own | covered by its consumer's proof |

Evidence:

- `apps/mobile/lib/invite-link.ts`: `parseInviteLink` dispatches over 4 URL forms, then a host
  allowlist, then a path-shape guard, then the `papel` lookup — 11 branch points -> decides
- `packages/types/src/index.ts#resolvePapelToRole`: a 3-row table behind a `typeof` guard and an
  exact-match rule, 3 branch points -> decides. Thin, and it is the one place where
  "`ALUNO` is not `aluno`" is decided for two apps
- `apps/mobile/app/+native-intent.ts`: dispatches over 3 outcomes — invite, `/baixar`,
  pass-through — and writes module state on exactly one of them, 3 branch points -> decides
- `apps/mobile/lib/pending-invite.ts`: 3 functions over one `let`, no conditional in any body ->
  instrumentation **by shape**, and it still gets the transition row: last-write-wins is a
  decision nothing else in the repo records, and TAT-191 inherits the signatures (door 3)
- `apps/web/lib/invite.ts#resolveInviteRole`: becomes a re-export of the shared function ->
  instrumentation, covered by C26, which is TAT-176's own test re-running unchanged
- closest analogue in the repo for rows 1 and 2: `apps/web/lib/store-links.ts#detectPlatform`
  (TAT-176) — a 4-class dispatch over one string, proven at its own layer with one asserted case
  per class. For row 4: `apps/web/app/.well-known/*/route.ts`, config-shaped output proven by
  calling the exported handler rather than by reading a committed file

Cost: 4 proofs at their own layer across 4 new files in `apps/mobile`, a package with none today,
plus the vitest runner itself (door 4) and one `expo config` invocation per run — 0.65s measured.
Without these rows the 4-class URL-form table, the 4-class `papel` table, the 4-class
pass-through dispatch and the 2 `initial` values are each proven only by whichever path one
happy-path call traverses, and one call traverses exactly one.

**One narrow ask:** do these five rows go into `AGENTS.md`'s `### Test policy`, together with the
four rows TAT-176 proposed for `apps/web` and never landed? They would be this repo's first
written answer for `apps/mobile`. Building under them needs no permission and is what happens
either way; approved rows land in their own commit before the build.

## Swept

- validation: C9, C11, C13, C14 — the refused `papel` tokens, the refused path shapes, the host allowlist, and the inputs that are not URLs at all
- failure modes: C14, C19 — an unparseable URL, and the pass-through. The failure that costs here is a URL the app cannot use being swallowed instead of handed back: `use-start-sso.ts` builds `tatame:///sso-callback` with `Linking.createURL`, and swallowing it breaks Google and Apple sign-in
- idempotency: C20, C22 — the same link arriving twice stores the same invite, and two different links are last-write-wins rather than an error. There is no delivery to deduplicate: the OS hands over one URL per tap and nothing is sent anywhere
- authorization: n/a - nothing here reads a session, calls the API or crosses a guard. `redirectSystemPath` runs before any auth state is known, and the invite it stores is a suggestion the API cannot act on — TAT-175 decision 3 fixes `POST /memberships/requests` to take the role from `req.appAuth!.role` and never from the client
- concurrency: C22 — two invites in one JS context. There is no other shared mutable state and no parallelism to race: expo-router calls `redirectSystemPath` on the JS thread, one URL at a time, from `getInitialURL` or from the `url` listener
- data lifecycle: n/a - nothing is persisted, so there is no TTL, archive, deletion or backfill. The pending invite dies with the JS context, and giving it a lifetime is TAT-191's decision behind door 3's signatures
- dependency failure: C19 — a URL shape expo-router hands over that this parser has never seen leaves the app exactly where it was before this ticket. The `/.well-known/*` files failing is the **normal** case today, since both answer `404` while their env vars are unset, and its consequence is the pre-ticket behaviour: the link opens the browser
- state transitions: C21, C22, C23 — the store's four states; plus C20 for the one input dimension (`initial`) that could have made the entry point behave differently in any of them
- observability: n/a - `apps/mobile` contains zero `console.*` calls today and ships no telemetry sink, so there is nothing for a link parse to log into. The API-side typed event catalog gains nothing from a parse that never reaches the API

## Handoff

Existing files the slices touch: 14 KB measured with `wc -c` across `apps/mobile/app.json`,
`apps/mobile/package.json`, `packages/types/src/index.ts`, `apps/web/lib/invite.ts`,
`apps/web/lib/invite.test.ts` and `apps/web/package.json`, plus roughly 12 KB of new files —
26 KB / 4 ≈ **~7k tokens**.

- S1 = 1k, in `apps/mobile`'s config; S2 at 3k; S3 at 5k; S4 crosses into `packages/types` and
  `apps/web` and closes at 7k, far under the 150k budget — **one builder, no handoff**
- No slice alone exceeds the budget. The only surface boundary (mobile -> shared package + web,
  after S3) sits at 5k, nowhere near a cut being needed

**Open, not blocking:** both of the plan's open questions. Question 1, the Apple Team ID and the
Android SHA-256 fingerprints, is `blocks go-live` and inherited from TAT-176 — AC 6 cannot be
satisfied on any device until the maintainer fills both in the deployment environment, and C1-C6
are what is provable without them. Question 2, whether `ios.bundleIdentifier` stays
`com.anonymous.tatame`, blocks nothing here.
