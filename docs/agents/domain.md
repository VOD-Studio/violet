# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — single-context layout; holds the glossary for all domains (authentication, article navigation/authorship, announcement presentation, mimo-music protocol service, musicctl CLI) in sectioned form.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. This repo mixes auth-series ADRs (`0001`/`0002`/`0003`/`auth-architecture-selection`) and mimo-music ADRs (`mimo-music-*`) in the same directory.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```
/
├── CONTEXT.md                 # glossary, all domains in sections
├── docs/
│   ├── adr/                   # mixed: auth-series + mimo-music ADRs
│   ├── prd/                   # PRDs (numbered)
│   └── issues/                # archived local-markdown issues (historical)
├── api/                       # blog backend (Chi + DDD)
├── web/                       # blog frontend (React + Vite)
└── mimo-music/                # independent Go module (netease service + musicctl CLI)
    └── docs/                  # musicctl-roadmap, musicctl-cli-design
```

**Note**: mimo-music is an independent Go module but its domain language lives in the root `CONTEXT.md` (under "网易云协议服务" and "musicctl CLI" sections). A future refactor may split it into `mimo-music/CONTEXT.md`, but for now everything is single-context.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

Notable vocabulary to respect:
- **Auth**: opaque Session ID (not "access token"), Session Envelope, 命门不变量
- **mimo-music**: Contract (proto), Endpoint Declaration (not "handler"), Recall Pool, 补全只走缓存, 双字符别名
- **musicctl**: 工具型定位 (not "客户端"), 召回池持久化 (history.jsonl)

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts mimo-music-dual-track-orchestration (A 类 CLI 接入是 Context 收尾硬约束) — but worth reopening because…_
