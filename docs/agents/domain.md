# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — single-context layout; holds the glossary for all domains (authentication, article navigation/authorship, announcement presentation) in sectioned form.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. This repo has auth-series ADRs (`0001`/`0002`/`0003`/`auth-architecture-selection`).

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```
/
├── CONTEXT.md                 # glossary, all domains in sections
├── docs/
│   ├── adr/                   # auth-series ADRs
│   ├── prd/                   # PRDs (numbered)
│   └── issues/                # archived local-markdown issues (historical)
├── api/                       # blog backend (Chi + DDD)
└── web/                       # blog frontend (React + Vite)
```

音乐能力服务由独立仓库 [`VOD-Studio/kite`](https://github.com/VOD-Studio/kite) 维护；本仓库目前不包含音乐模块或 Kite 适配器。

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

Notable vocabulary to respect:
- **Auth**: opaque Session ID (not "access token"), Session Envelope, 命门不变量

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts auth-architecture-selection (opaque session 不落地 localStorage) — but worth reopening because…_
