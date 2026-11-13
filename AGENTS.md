# Tatame — notes for agents

- **Git commits** — Write all commit messages in English (subject and body), and always lead with the
  Linear ticket in lowercase brackets:

  ```
  [tat-170] feat: add the payout account card to the dashboard
  [tat-179] fix: stop the new payout account bouncing back to the form
  ```

  The ticket number comes first, then the conventional-commit type. Work with no ticket
  (chores, tooling) may omit the bracket, but anything tied to a Linear issue must carry it.
- **Branching** — Use classic git branches (`git checkout -b`). Do **not** use git worktrees unless explicitly requested.
- **Branch and PR flow** — `main` is the release branch. Merging into it does **not** deploy:
  auto-deploy on merge is **switched off** in Coolify, and the production deploy is triggered
  manually there. Still, nothing is pushed straight to `main` without being asked.

  1. Branch off `dev` for each feature / ticket / bug fix.
  2. When the work is done, open the PR **against `dev`** — never against `main`.
  3. `dev` accumulates finished work; promoting `dev` to `main` is a **manual step the
     maintainer does**.

  Never open a PR targeting `main` and never merge into `main` without being asked.
- **Language** — All code (variables, functions, classes, comments, commits) must be written in **English**. User-facing content (labels, messages, placeholders, errors, toasts, etc.) must be in **Brazilian Portuguese** with correct accentuation.
- **Linear tasks** — All tasks must be created in Linear, always in this exact destination:

  - **Workspace** — `Jeremias` (https://linear.app/tatame) — verify with `get_workspace` before creating anything; other workspaces (e.g. `<Cand!date!>` / candidateappbr) are **not** this project
  - **Team** — `Tatame` (key `TAT`) — not `Cla-Code`/`PAV`
  - **Project** — `Tatame App`
  - **State** — `Backlog`
  - **Language** — content in **English**

  Every task must follow this structure:

  - **Title** — concise summary of the task
  - **Description** — detailed explanation of what needs to be done
  - **Acceptance Criteria** — clear conditions that must be met for the task to be considered done

- **Styling** — All styling must use **NativeWind** (mobile) and **Tailwind CSS** (web). Use `className` with utility classes, not inline `style` objects. Only fall back to `style` for truly dynamic values (e.g. colors from data, safe area insets) or features not available in NativeWind/Tailwind.
- **Designs** — All UI designs live in `design.pen`. Always use the **Pencil MCP** tools (`batch_get`, `get_screenshot`, `get_guidelines`, etc.) to read designs — never use `Read` or `Grep` on `.pen` files.
- **Custom skills** — The project has custom skills in `.agents/skills/`. When asked to use a skill not listed in the Skill tool's invocable list, always check `.agents/skills/<skill-name>/SKILL.md` before saying it doesn't exist. Read the `SKILL.md` and follow its instructions.
- **Billing — there is no free plan** — Every manager subscribes. The first month is granted as a
  **Stripe trial on the `pro` plan**, so a manager in their free month is `plan: "pro"` with
  `trialEndsAt` set and has the **full feature set** — never a reduced one.

  `plan` is only ever written as `"pro"` (`manager-subscription.service.ts`,
  `stripe-subscription-webhook.handler.ts`). No code path writes `"free"`.

  This makes the following **dead code** — do not reason about product behaviour from it:

  - `FREE_PLAN_LIMITS` in `apps/api/src/modules/manager-subscription/plan-limits.ts`
    (`maxStudents: 30`, `maxInstructors: 1`, …) — these limits **cannot be reached** by a
    subscribed manager, and an academy with no subscription row is already rejected earlier by
    `requireActivePlan` with `403 NO_SUBSCRIPTION`.
  - Every `sub.plan === "free"` branch in the membership, class, payment and subscription
    services — reachable only by legacy rows, if any.
  - The synthesized `plan: "free"` fallback in `managerSubscriptionService.getLimits()`.

  When a feature's behaviour appears to depend on a free tier, it does not. Treat the limits above
  as unreachable unless the product decision to reintroduce a free tier is made explicitly.

## tlc-spec-lean

profile: standard
budget: 150k

`standard` rather than the skill's `light` default, and it holds for every feature unless the
maintainer asks for something else on that task. What it buys over `light` is the two failure
classes `light` cannot see: a check whose test would stay green under a wrong implementation,
and a set member nobody proved. The Verifier injects one fault per assertion surface and
recomputes the `Coverage` join from the authority over each set, instead of reading the author's
table back.

The reason it is worth the cost here: this codebase's expensive bugs have been silent-zero bugs —
a metric that keeps rendering and stops measuring (`unpaidPixPerAcademy` summing the wrong rail),
a webhook branch that returns 200 and writes nothing. A green test proves nothing about either
unless something deliberately breaks the implementation and watches the test react.

### Test policy

Two rules about **what deserves a test and how deeply**, which is a different question from where
tests live and how they are built — unit with in-memory repositories, integration against a real
Postgres through testcontainers. Keying the level to whether a test uses real dependencies decides
how to *write* a test; read as deciding what *deserves* one, every decision table that touches a
real dependency gets routed away from its own layer and its cases are never enumerated.

Classify by the shape of the code, never by the name of the layer:

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decides, and reachable only through SQL | one at the integration layer against real Postgres | one asserted case per predicate, and one per grouping-key arity |
| Entry point that decides nothing — a route's existence | one at the boundary through the assembled app | the path under claim, plus a live sibling on the same router in the same test |

**Why the first row.** A repository method's predicates are invisible to every caller, so no unit
test can assert them and a passing integration test that happens to traverse one proves nothing
about it. TAT-187 is the worked example: `unpaidPixPerAcademy` had a case for the day window's
lower bound and none for its upper bound, and deleting `lt(createdAt, window.end)` left the whole
860-test suite green. `collectDay` reads two windows to compare a day against the one before it,
so with no upper bound both numbers grow without end and the comparison stops measuring — the
second time this one function has produced a number that renders and does not measure. The
precedent to copy is `platform-summary.integration.test.ts`, which proves `paymentsPerMethod`,
`overduePerAcademy` and the BRT window at that level with one case per predicate.

**Why the second row.** A `404` cannot tell a removed route from a router that stopped mounting,
and the second is a total outage that reads in a test as success. Asserting a live sibling on the
same router in the same test is what separates them. `api.smoke.test.ts` is the example: the
removed paths answer `404` while `POST /v1/payments/pix` answers `503` for the missing Clerk key.
