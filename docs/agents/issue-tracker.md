# Issue tracker: GitHub (primary) + local markdown (fallback)

Issues for this repo live on **GitHub Issues** as the primary tracker. When `gh` CLI is unavailable (offline, CI sandbox, air-gapped), fall back to local markdown under `docs/issues/<prd-id>/`.

## Primary: GitHub Issues

Use the `gh` CLI for all operations.

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Fallback: local markdown (when `gh` is unavailable)

Layout follows the existing `docs/issues/` convention (used by historical PRD-0001 / PRD-0002 issue breakdowns):

```
docs/issues/
└── <prd-id-or-slug>/          # e.g. 0002-登录态opaque-session重构/
    ├── 0001-<slug>.md          # one file per issue, zero-padded
    ├── 0002-<slug>.md
    └── ...
```

Each file uses the same body template as a GitHub issue (Parent / What to build / Acceptance criteria / Blocked by). The filename's leading number is the issue's local identifier; cross-references use `0001` style within the same PRD folder.

**When to fall back**: only when `gh auth status` fails or `gh` binary is missing. Otherwise always prefer GitHub — the GitHub issue number is the canonical identifier.

**Historical issues** under `docs/issues/0005-*` and `docs/issues/0009-*` are **archived snapshots** from before GitHub migration. Do not modify them; do not re-create on GitHub unless explicitly asked.

## Pull requests as a triage surface

**PRs as a request surface: no.** External PRs are not treated as feature requests. `/triage` processes issues only, not PRs.

## When a skill says "publish to the issue tracker"

Create a GitHub issue via `gh issue create`. If `gh` is unavailable, write a local markdown file under `docs/issues/<prd-id>/` with the next available zero-padded number.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`. For local fallback, read the file at `docs/issues/<prd-id>/<num>-<slug>.md`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
