# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- [CONTEXT.md](../../CONTEXT.md) is the glossary for all domains. Look up the term before naming an issue, type, or test.
- Read the [architecture decisions](../adr/) relevant to the change, and check whether a later decision supersedes them.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```
/
├── CONTEXT.md                 # glossary, all domains in sections
├── docs/
│   ├── adr/                   # architecture decisions
│   ├── prd/                   # historical and offline PRDs
│   └── issues/                # historical and offline implementation issues
├── api/                       # blog backend (Chi + DDD)
└── web/                       # blog frontend (React + Vite)
```

[Kite](https://github.com/VOD-Studio/kite) is the upstream music service. Violet owns the [site music domain](../../api/internal/domain/music/), its [Kite adapter](../../api/internal/infrastructure/kite/), and the [site-facing HTTP API](../../api/README.md#站点音乐接口kite).

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

Notable vocabulary to respect:
- **Auth**: opaque Session ID (not "access token"), Session Envelope, and the glossary term `命门不变量`.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> This would change the existing auth decision: opaque session IDs must not be stored in `localStorage`. Here is why the decision should be reopened.
