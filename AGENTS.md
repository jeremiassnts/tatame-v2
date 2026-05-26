# Tatame — notes for agents

- **Git commits** — Write all commit messages in English (subject and body).
- **Branching** — Use classic git branches (`git checkout -b`). Do **not** use git worktrees unless explicitly requested.
- **Language** — All code (variables, functions, classes, comments, commits) must be written in **English**. User-facing content (labels, messages, placeholders, errors, toasts, etc.) must be in **Brazilian Portuguese** with correct accentuation.
- **Linear tasks** — All tasks must be created in Linear, in the **Tatame** team, with content in **English** and the following structure:
  - **Title** — concise summary of the task
  - **Description** — detailed explanation of what needs to be done
  - **Acceptance Criteria** — clear conditions that must be met for the task to be considered done
- **Styling** — All styling must use **NativeWind** (mobile) and **Tailwind CSS** (web). Use `className` with utility classes, not inline `style` objects. Only fall back to `style` for truly dynamic values (e.g. colors from data, safe area insets) or features not available in NativeWind/Tailwind.
- **Designs** — All UI designs live in `design.pen`. Always use the **Pencil MCP** tools (`batch_get`, `get_screenshot`, `get_guidelines`, etc.) to read designs — never use `Read` or `Grep` on `.pen` files.
