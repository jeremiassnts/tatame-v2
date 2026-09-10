# Tatame — notes for agents

- **Git commits** — Write all commit messages in English (subject and body).
- **Branching** — Use classic git branches (`git checkout -b`). Do **not** use git worktrees unless explicitly requested.
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
