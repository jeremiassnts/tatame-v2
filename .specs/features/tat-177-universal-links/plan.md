# TAT-177 — Universal Links and App Links so invite links open in the app

## Problem

The invite link TAT-176 shipped always opens a browser, including on a phone that already has
Tatame installed. The person taps `https://apptatame.com.br/convite/<academyId>?papel=aluno`,
lands on a page whose only offer is a store button, taps it, and the store says "Abrir" — they
are back where they started, and the academy identity the link carried was dropped on the floor.
The page's own closing sentence, shipped and live, is
`Já instalou? Toque neste link de novo para entrar direto na academia.` — a promise nothing in
the app can keep: `apps/mobile/app.json` declares `"scheme": "tatame"` and nothing else, with no
`ios.associatedDomains` and no `android.intentFilters`, so neither OS claims the domain.

Evidence the source gives: TAT-175 states managers are using the platform while students and
instructors are not getting registered, with no figure. TAT-176's `checks.md` records both
association files as built, proven and **unconfigured** — `IOS_APP_ID` and
`ANDROID_SHA256_CERT_FINGERPRINTS` are unset, so both answer `404` today.

When this ships, a person with the app installed taps the invite link and the app opens, with
the academy id and the suggested role in hand for TAT-191 to use.

## Flow

Reuses expo-router's own inbound-URL seam — `+native-intent.ts`'s `redirectSystemPath`, which
the router already calls on the cold-start URL (`getLinkingConfig.js` `getInitialURL`) **and** on
every URL that arrives while the app is running (`link/linking.js` `subscribe`) — instead of
adding a second `Linking.addEventListener` beside the one the router already owns.

1. the OS opens `https://apptatame.com.br/convite/<academyId>?papel=aluno` after verifying the domain against `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` (exists, TAT-176) — `apps/mobile/app.json` is what claims it (door 1)
2. expo-router `getInitialURL` (cold start) or `subscribe` (already running) (exists) - hands the full URL string to `redirectSystemPath`
3. `apps/mobile/app/+native-intent.ts` (new, door 2) - the single inbound-URL entry point; calls the parser and returns the in-app path
4. `apps/mobile/lib/invite-link.ts` (new, no door - placement per conventions) - `parseInviteLink(url)` returns `{ academyId, role }`, or `null` for anything that is not an invite link; the `papel` token is resolved by `@tatame/types` (exists, door 5), not by a table of its own
5. `apps/mobile/lib/pending-invite.ts` (new, door 3) - `setPendingInvite({ academyId, role })` holds it; TAT-191 replaces the body with persistence and is the first thing to read it
6. out: `redirectSystemPath` returns `/`, so `apps/mobile/app/index.tsx` (exists, untouched) routes by auth state as it already does; a URL that is not ours is returned unchanged and expo-router resolves it exactly as it does today

## Impact

| Front | What changes |
| --- | --- |
| domain | new term: `pending invite` — the `{ academyId, role }` an inbound link leaves behind, held in `apps/mobile/lib/pending-invite.ts`. Nothing reads it in this ticket; TAT-191 is its only consumer |
| domain | existing term: `papel` meant "a URL token the web invite page reads" (TAT-176), now means "a URL token two apps read" — `apps/web/lib/invite.ts` is the only thing that branches on it today, and it **does** change: its local `PAPEL_TO_ROLE` table is deleted and it resolves through `@tatame/types` instead (door 5). TAT-176's checks C17 and C18 are the regression guard and must stay green |
| domain | no other existing term changes meaning |
| stored data | nothing to migrate — no schema change, no backfill, no new column. The pending invite is module state, not a row |
| existing mobile routing | `+native-intent.ts` lands on the path of **every** inbound URL the app ever receives, including the `tatame:///sso-callback` that `lib/hooks/use-start-sso.ts` builds with `Linking.createURL`. A parser that rewrites anything it does not recognise breaks Google and Apple sign-in |
| existing native config | `app.json` gains `ios.associatedDomains` and `android.intentFilters`. The project is managed — there is no `apps/mobile/ios` or `apps/mobile/android` directory — so these reach a binary only through a prebuild or an EAS build, and **Expo Go cannot see them at all** |
| existing web app | `apps/web/package.json` gains its first `@tatame/*` workspace dependency. `@tatame/types` resolves through `exports.import` to `dist/`, so `apps/web`'s build, typecheck and vitest run all now require `pnpm build` to have run first — which `turbo`'s `dependsOn: ["^build"]` already arranges for `build`, `typecheck` and `test`, and which TAT-176's `checks.md` already names as a prerequisite for running a proof by hand |
| existing CI | `apps/mobile` gains a test runner, so `turbo run test` starts running a third package. `apps/mobile`'s `typecheck` script stays the stub it is today (`echo 'skipped: NativeWind className types need metro plugin'`) — this ticket does not fix that |
| existing go-live | nothing in this ticket works on a real device until `IOS_APP_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` are filled in the deployment environment. That is TAT-176's open question, inherited here |

## Relations

`None - no stored-data shape change`

The pending invite lives in module state for the life of one JS context. Giving it a row, a
column or a key is TAT-191's decision, because TAT-191 is what needs it to survive something.

## Surface

`None - nothing consumed outside`

This feature adds no route anyone calls. The two URL shapes it claims from the OS —
`https://apptatame.com.br/convite/<academyId>` and `https://apptatame.com.br/baixar` — are
served by `apps/web` and were shipped unchanged by TAT-176; nothing about their request or
response changes here. The inbound-link entry point is a function the OS reaches through
expo-router, with no status codes and no wire format, so its cases become `Coverage` set rows in
`checks.md` rather than a route signature.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1 — the app claims the apex domain | `app.json`: `expo.ios.associatedDomains: ["applinks:apptatame.com.br"]`, and one `expo.android.intentFilters` entry — `{ "action": "VIEW", "autoVerify": true, "category": ["BROWSABLE", "DEFAULT"], "data": [{ "scheme": "https", "host": "apptatame.com.br", "pathPrefix": "/convite/" }, { "scheme": "https", "host": "apptatame.com.br", "path": "/baixar" }] }` | Claiming a dedicated `link.apptatame.com.br` instead of the apex. TAT-176 already shipped the link vocabulary on the apex and `/convite/<id>` links are what managers will paste into group chats; a subdomain now means two live link shapes forever, and the old one can never be retired because nobody can recall a WhatsApp message. The cost accepted in exchange: every path Apple's AASA `components` lists stops being openable in an iOS browser, so adding a marketing path to that file is now a breaking change |
| 2 — `+native-intent.ts` is the single inbound-URL entry point | `apps/mobile/app/+native-intent.ts` exporting `export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string` — a pure function, no React, no `expo-linking` import | An expo-router route `apps/mobile/app/convite/[academyId].tsx` reading `useLocalSearchParams()`. Rejected because that screen would have to decide where to send the person next — signed out, signed in with no role, signed in with a membership already — and that decision is TAT-191's, so the route would either render a dead end or pull TAT-191 into this ticket. It also publishes a URL into the app's own sitemap that nothing inside the app navigates to, and it cannot be exercised without a renderer, while `redirectSystemPath` is settled by a string in and a string out |
| 3 — the pending-invite seam TAT-191 inherits | `apps/mobile/lib/pending-invite.ts` exporting `export type PendingInvite = { academyId: string; role: InviteRole \| null }`, `setPendingInvite(invite: PendingInvite): void`, `readPendingInvite(): PendingInvite \| null`, `clearPendingInvite(): void`, backed by a module-level `let` — TAT-191 replaces the body with persistence and keeps all three signatures | Returning `/convite/<id>?papel=<token>` from `redirectSystemPath` and letting TAT-191 read the params off the route. Rejected because those params would then have to survive every navigation TAT-191 adds — sign-in, `(onboarding)/user-type`, `(joining)/search-academy` — and a query string does not survive `router.replace`, so TAT-191 would have to build this store anyway, one ticket later, with a live link format already depending on the weaker shape |
| 4 — a test runner in `apps/mobile` | `vitest` devDependency, `apps/mobile/vitest.config.ts` with `test.environment: "node"`, `test.include: ["{app,lib}/**/*.test.ts"]` and the `@` alias matching `tsconfig.json`'s `paths`, plus `"test": "vitest run"` and `"test:unit": "vitest run"` in `apps/mobile/package.json` so `turbo run test` picks the package up | `jest-expo` with the react-native preset. Rejected because every decision this ticket makes is a pure string function and a three-function module with no React in it, so a renderer buys nothing, and it would put a second test runner in a repo that already standardised on vitest in `apps/api` and `apps/web` — precedent, which is the part that stops being reversible once TAT-178 and TAT-191 copy it |

| 5 — the `papel` vocabulary becomes a shared module | `packages/types/src/index.ts` exports `export type InviteRole = Exclude<Role, "manager">`, `export const PAPEL_TO_ROLE: Record<string, InviteRole>` with exactly `aluno`/`instrutor`/`responsavel`, and `export function resolvePapelToRole(papel: string \| string[] \| undefined): InviteRole \| null` doing an exact-match lookup. `apps/web/package.json` gains `"@tatame/types": "workspace:*"`, and `apps/web/lib/invite.ts` deletes its own table and re-exports `resolveInviteRole` through the shared function while keeping `ROLE_LABELS`, which is Portuguese copy and stays per-app | Duplicating the three-row table in `apps/mobile/lib/invite-link.ts`, which is what TAT-176 assumed would happen. Rejected by the maintainer: two tables mean the exact-match rule — no `ALUNO`, no trimming, no aliases — gets re-decided per app, and the rule is the part that cannot drift once links are circulating in group chats. The cost accepted in exchange: `apps/web` now has a workspace dependency and therefore a build order, where before it had neither |

- Adding `/baixar` to the Android filter alongside iOS's existing AASA claim is reversible: drop the `data` item and the link opens the browser again, which is what it does today.
- Nothing else in this change is hard to reverse.

## Criteria

### S1: the OS hands invite links to the app (P1)

A build produced from this `app.json` is claimed by both operating systems.

**Acceptance Criteria**

1. The mobile app config SHALL declare `expo.ios.associatedDomains` in `apps/mobile/app.json` as exactly `["applinks:apptatame.com.br"]`
2. The mobile app config SHALL declare an entry in `expo.android.intentFilters` whose `action` is `VIEW`, whose `autoVerify` is `true`, and whose `category` contains both `BROWSABLE` and `DEFAULT`
3. The Android intent filter's `data` SHALL contain an item with `scheme: "https"`, `host: "apptatame.com.br"` and `pathPrefix: "/convite/"`
4. The Android intent filter's `data` SHALL contain an item with `scheme: "https"`, `host: "apptatame.com.br"` and `path: "/baixar"`
5. The mobile app config SHALL keep `expo.scheme` equal to `tatame`
6. WHEN a person taps `https://apptatame.com.br/convite/<academyId>` on a device running a build produced from this `app.json` THEN the OS SHALL open the app directly, showing neither a browser page nor a chooser dialog

**Independent test:** `npx expo prebuild --platform android --clean` and read
`android/app/src/main/AndroidManifest.xml` for `android:autoVerify="true"` and the two `<data>`
entries; `npx expo prebuild --platform ios --clean` and read
`ios/Tatame/Tatame.entitlements` for `applinks:apptatame.com.br`. AC 6 itself needs an EAS
`preview` build on a real phone with both env vars filled — see open question 1.

### S2: an invite URL becomes an academy id and a suggested role (P1)

The link's two parameters survive the trip from the OS into JS, in every URL form the app can receive one. The `papel` half resolves through the shared module S4 creates.

**Acceptance Criteria**

7. WHEN `parseInviteLink` is given `https://apptatame.com.br/convite/<academyId>?papel=aluno` THEN it SHALL return `{ academyId: "<academyId>", role: "student" }`
8. WHEN the `papel` token is `instrutor` THEN `parseInviteLink` SHALL return `role` equal to `"instructor"`
9. WHEN the `papel` token is `responsavel` THEN `parseInviteLink` SHALL return `role` equal to `"guardian"`
10. IF `papel` is absent, empty, or any token other than `aluno`, `instrutor` and `responsavel` THEN `parseInviteLink` SHALL return the same `academyId` with `role` equal to `null`
11. The `academyId` `parseInviteLink` returns SHALL be the single URL-decoded path segment immediately following `/convite/`
12. IF the path carries no segment, or more than one segment, after `/convite/` THEN `parseInviteLink` SHALL return `null`
13. The parser SHALL return the same `parseInviteLink` result for all four URL forms of one invite: `https://apptatame.com.br/convite/<id>?papel=aluno`, `tatame:///convite/<id>?papel=aluno`, `exp://192.168.0.2:8081/--/convite/<id>?papel=aluno` and `/convite/<id>?papel=aluno`
14. IF an `http` or `https` URL's host is anything other than `apptatame.com.br` THEN `parseInviteLink` SHALL return `null`
15. IF the URL cannot be parsed at all THEN `parseInviteLink` SHALL return `null` and SHALL NOT throw

**Independent test:** in Expo Go on the phone, `npx uri-scheme open "exp://<lan-ip>:8081/--/convite/<seeded academy id>?papel=instrutor" --android`, and confirm the app lands on its root screen rather than the unmatched-route screen.

### S3: the invite is handed on and the app opens at its root (P1)

Every inbound URL ends up either as a pending invite or exactly where it would have gone before this ticket.

**Acceptance Criteria**

16. WHEN `redirectSystemPath` is given an invite link THEN it SHALL call `setPendingInvite` exactly once with the parsed `academyId` and `role`
17. WHEN `redirectSystemPath` is given an invite link THEN it SHALL return `/`
18. WHEN `redirectSystemPath` is given `https://apptatame.com.br/baixar` THEN it SHALL return `/`
19. WHILE the URL is not an invite link `redirectSystemPath` SHALL leave the pending invite as it was
20. IF the URL is neither an invite link nor `/baixar` on `apptatame.com.br` THEN `redirectSystemPath` SHALL return the `path` string it was given, byte for byte — `tatame:///sso-callback` included
21. The entry point SHALL make `redirectSystemPath` return the same value and leave the same pending invite whether `initial` is `true` or `false`
22. The pending-invite store SHALL answer `readPendingInvite` with `null` before `setPendingInvite` is ever called
23. WHEN `setPendingInvite` is called twice in one JS context THEN `readPendingInvite` SHALL return the invite from the second call
24. WHEN `clearPendingInvite` is called THEN `readPendingInvite` SHALL return `null`

**Independent test:** sign out, sign in with Google in a `preview` build, and confirm the SSO round trip still completes — that is AC 20 on the one URL that would break loudly.

### S4: one definition of the `papel` vocabulary (P1)

Both apps read the token through the same function, so the exact-match rule cannot drift.

**Acceptance Criteria**

25. The shared types package SHALL export `resolvePapelToRole`, returning `"student"` for `aluno`, `"instructor"` for `instrutor`, `"guardian"` for `responsavel`, and `null` for every other input including `ALUNO`, `" aluno"`, `""`, `undefined` and an array
26. The repository SHALL hold the `papel` → role mapping in exactly one module, and no file under `apps/` SHALL contain the literal token `instrutor` paired with `instructor`
27. WHEN `apps/web`'s `resolveInviteRole` is given any of the three tokens or an unrecognised one THEN it SHALL return the value it returned before this ticket, resolving through the shared module

**Independent test:** `pnpm build && pnpm --filter @tatame/web exec vitest run lib/invite.test.ts`
— TAT-176's own C17 and C18 pass unchanged against the shared implementation.

## Out of scope

Product capabilities only.

| Excluded | Why |
| --- | --- |
| Persisting the pending invite across a process restart or the store round-trip | TAT-191 — door 3 fixes the signatures so it can be done without touching this ticket's callers |
| Reading the pending invite anywhere — `(app)/index.tsx`, `(onboarding)/user-type`, `(joining)/*` | TAT-191. This ticket's description names those files as off limits |
| The manager's share and invite actions and the role picker | TAT-178 |
| Deferred deep linking (Branch, Adjust, Install Referrer) | TAT-175 design decision 4 — the store round-trip deliberately loses the query string, and TAT-176's re-tap sentence is the mechanism |
| Filling `IOS_APP_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` | TAT-176's open go-live question, inherited — the maintainer sets both in the deployment environment |
| A `+not-found` screen for the app | expo-router already generates one, and AC 20 keeps this ticket from changing which URLs reach it |
| `apps/mobile`'s stubbed `typecheck` script | pre-existing, and unrelated to linking |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Whether Android claims `/baixar` as well as `/convite/*` | claim both, matching the AASA TAT-176 already shipped | TAT-176's `apple-app-site-association` lists `/convite/*` **and** `/baixar`, so iOS already opens the app for the download page. Leaving Android behind means the same tap behaves differently per platform for no reason, and the download page is useless to someone who already has the app | n |
| What `redirectSystemPath` returns for an invite | `/`, letting `app/index.tsx`'s existing auth routing run | the alternative is this ticket deciding where a signed-out invitee goes, which is TAT-191's call. `/` is the one answer that is correct in every auth state | n |
| Whether a malformed invite path takes its first segment or is rejected | reject — `parseInviteLink` returns `null` for `/convite/` and for `/convite/<id>/extra` | both Apple's `/convite/*` and Android's `pathPrefix: "/convite/"` match more than the app can use, so the app receives shapes the link generator never produces. Guessing an academy id out of one is worse than opening at the root | n |
| Whether the parser accepts the Expo Go `exp://…/--/…` URL form | yes, AC 13 | mobile is developed in Expo Go on a real Android phone, and native configuration cannot be verified there at all. Accepting the `exp://` form is what makes S2 and S3 verifiable by hand today instead of only after an EAS build | n |
| Whether the parser accepts `www.apptatame.com.br` | no — apex host only | the association files are served on the apex only, so no other host can ever reach the app. A second accepted host would be a parser branch nothing can exercise | n |
| Verification profile | `standard` | the maintainer chose it; it matches TAT-176 on this same epic, and `light` by its own table cannot catch an enumerated set member nobody proved — this ticket's value is almost entirely in enumerated sets (URL forms, `papel` tokens, `initial` states) | y |
| Whether `apps/web` needs `transpilePackages: ["@tatame/types"]` | start without it; add it only if `next build` fails on the ESM workspace package | `@tatame/types` is `"type": "module"` with an `exports.import` entry pointing at built `dist/`, which Next 15 consumes directly. Guessing at a config flag before the build has complained is how dead configuration accumulates — AC 27's proof and the real `next build` in TAT-176's C33 are what decide it | n |
| Where the invite-link tests live | beside their module, `apps/mobile/lib/invite-link.test.ts` and `apps/mobile/app/+native-intent.test.ts` | matches `apps/web`, where `lib/invite.test.ts` and `app/baixar/page.test.tsx` sit next to what they prove | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | TAT-176's question, unresolved and now blocking: what is the Apple Team ID (so `IOS_APP_ID` = `<TeamID>.com.anonymous.tatame`) and the SHA-256 certificate fingerprint(s) for `com.anonymous.tatame`? Both `/.well-known/*` routes answer `404` while they are unset | AC 6 cannot be satisfied on any device, and neither OS will verify the domain — every invite link keeps opening the browser. AC 1–5 and all of S2 and S3 land and are provable regardless; the app is simply claiming a domain nobody has confirmed back to it yet |
| 2 | open | Does `app.json`'s `expo.ios.bundleIdentifier` stay `com.anonymous.tatame`? It is the Expo scaffold default, and it is baked into the `IOS_APP_ID` and the `assetlinks.json` package name | Nothing here is blocked — this ticket does not read the identifier. It is flagged because changing it after the first store release is not possible, and TAT-176's association files name it |

## Observable

Worksheet, not the review.

| Surface | Decision | Landing |
| --- | --- | --- |
| inbound link `redirectSystemPath` | response shape — what it returns | AC 17, AC 18, AC 20 |
| inbound link `redirectSystemPath` | error shape and codes | AC 15, AC 20 — there is no error channel; a URL it cannot use is returned unchanged, which is the pre-ticket behaviour |
| inbound link `redirectSystemPath` | who may call it | n/a - only the OS, through expo-router's own `getInitialURL` and `subscribe`. Nothing the app ships calls it |
| inbound link `redirectSystemPath` | versioning | n/a - the link vocabulary is frozen by TAT-175 and the function has no contract of its own that anything outside the app reads |
| inbound link `redirectSystemPath` | rate limit behaviour | n/a - the OS delivers at most one URL per tap, and AC 23 settles what two in a row mean |
| screen or view | empty, loading, error, unauthorised, density, destructive confirms | n/a - this feature renders nothing. Every screen that will read the pending invite is TAT-191's |
| command or scheduled task | output, flags, exit codes, partial failure | n/a - nothing here runs from a terminal or on a schedule |
| document or copy someone reads | structure, tone, depth, next action | n/a - no user-facing copy. The one sentence that promises the re-tap shipped in TAT-176 and is unchanged |
| a collection being organised | grouping, naming, ordering, duplicates | n/a - nothing enumerates, groups or orders |

## Sources

- TAT-177 — the acceptance criteria this plan derives from, and the boundary it fixes: deliver the URL and its parameters, decide nothing about onboarding or roles
- TAT-175 — freezes the link vocabulary `?papel=aluno|instrutor|responsavel` and design decision 4, no deferred deep linking
- `.specs/features/tat-176-public-invite-page/` — the plan and checks for the association files and the `papel` table this ticket consumes, including the unresolved go-live question
- `apps/mobile/node_modules/expo-router/build/getLinkingConfig.js` and `build/link/linking.js` — where `redirectSystemPath` is called on the cold-start URL and on every later URL, which is what makes door 2 cover both entry paths
- `@expo/config-types@57.0.2` `ExpoConfig.d.ts` — the literal shapes of `ios.associatedDomains`, `android.intentFilters` and `AndroidIntentFiltersData`
- `AGENTS.md` — commit prefix, English code, PRs against the branch they belong to
