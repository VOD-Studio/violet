# musicctl 用 musicctl/v* 作用域 tag 触发发布

monorepo 内博客主项目已占用裸 `v*` tag（push 即触发 `deploy.yml` 生产部署）。musicctl 的 goreleaser 发布需要与之隔离的触发面。决定：musicctl 的发布 tag 一律带作用域前缀 `musicctl/vX.Y.Z`，发布 workflow 以 `tags: ['musicctl/v*']` 触发，版本从 0.1.0 起独立演进；brew tap 按 roadmap 保持后置，GitHub Release 二进制先行。tag 一旦发布不可撤回，前缀必须在首发前定死，故立此 ADR。

## Considered Options

- **共用博客裸 `v\*` tag**——否决：musicctl 的 tag 会误触发 `deploy.yml` 部署博客生产环境，musicctl 版本号也被博客发版节奏绑架，两边都无法独立演进。
- **拆独立仓库发布**——否决：超出当前工程量，且 musicctl 与 mimo-music server 共享 endpoint/engine 代码，拆仓库时机未到。

## Consequences

- 博客 `release.sh` / `deploy.yml` 与 musicctl 发布互不相干，两条发布轨并行。
- 将来若 musicctl 拆独立仓库，`musicctl/v*` tag 历史可原样带走，无前缀冲突。
