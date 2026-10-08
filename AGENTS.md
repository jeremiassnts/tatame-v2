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
- **Branch and PR flow** — `main` is deploy-on-merge, so nothing is pushed straight to it.

  1. Branch off `dev` for each feature / ticket / bug fix.
  2. When the work is done, open the PR **against `dev`** — never against `main`.
  3. `dev` accumulates finished work; promoting `dev` to `main` is a **manual step the
     maintainer does**, and triggers the production deploy.

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
