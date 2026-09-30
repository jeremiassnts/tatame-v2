# Tasks — Sign-out on the pre-role screens (TAT-183)

| # | Task | Depends on | Covers |
| --- | --- | --- | --- |
| 1 | `components/SignOutButton.tsx` — footer control owning the teardown | — | SIGNOUT-01, SIGNOUT-02 |
| 2 | Mount it in `(app)/(joining)/search-academy.tsx` | 1 | SIGNOUT-03 |
| 3 | Mount it in `(app)/(joining)/pending-approval.tsx` | 1 | SIGNOUT-04 |
| 4 | Mount it in `(app)/create-academy.tsx`, disabled while submitting | 1 | SIGNOUT-05 |
| 5 | Record the audit of the remaining pre-role screens in `spec.md` Out of Scope | — | SIGNOUT-06 |

**Gate command:** `pnpm --filter @tatame/mobile exec tsc --noEmit -p tsconfig.json`

`apps/mobile` has no test suite and its `typecheck`/`lint` scripts are no-op stubs, so the
gate is `tsc` invoked directly plus the manual walkthrough in each story's *Independent
Test*. No automated coverage is claimed for this feature.

## Design notes

**One component, not a hook.** All three call sites want the same thing — a footer button
labelled "Sair da conta" — so a single component carries both the affordance and the
teardown. A bare `useLogout` hook would leave three copies of the same `Pressable` behind.

**`profile.tsx` is left alone.** Its sign-out is a row inside a settings list with an icon
and a chevron, not a footer button. Sharing would mean parameterising the component into
two unrelated shapes for no gain.

**Teardown order** follows the existing `handleLogout` in `profile.tsx`:
`queryClient.clear()` → `signOut()` → `router.replace("/(auth)")`. The cache is cleared
first so no component can re-render against the previous account's data during sign-out.

**`useQueryClient()`, not the module singleton.** `(app)/_layout.tsx` wraps its subtree in a
`QueryClientProvider` holding the `queryClient` from `lib/query-client`, while the root
`app/_layout.tsx` provides a different instance. Reading from context clears the same client
the screens actually read through — importing the singleton would be correct by accident
here and wrong the moment the provider nesting changes.
