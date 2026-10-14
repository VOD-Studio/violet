# 拆分为独立仓库的计划

#517 的一部分。**尚未执行**：创建仓库是对外部的、难以撤回的动作，需要有人明确决定时机并创建。本文给出建议的时机与名字、拆分后的仓库结构、仓库自己的调试方式，以及开发阶段与 Violet 联调的方式，并保证“一条命令可执行，历史不丢”。

## 建议：现在拆

| 理由 | 说明 |
|---|---|
| 发版互不牵连 | 宠物的 `feat` 提交会让 release-please 给 Violet 开发版 PR，而站点并没有改动。独立后宠物有自己的版本与发布节奏 |
| 仓库体量 | `pet/` 带 Rust 工具链、wasm 构建和 Postgres 端到端，CI 与本地缓存都和 Violet 无关 |
| 边界已经成型 | `pet/` 不读 Violet 的任何文件；Violet 只通过身份断言、活动事件与 SDK 三条通道接触它（ADR-0021） |
| 历史可无损迁出 | 见下文执行步骤 |

时机：**先合并 PR #541（用 merge commit），再拆。** 这样 `release/2.0` 上之后的宠物历史是原子提交，不必再重放；只有更早被 squash 的 #516 需要从 `refs/pull/516/head` 取原始提交。

## 仓库名：`VOD-Studio/kodama`

组织里的仓库都是单词代号（`kite`、`inori`、`saber`、`hesper`、`aether`、`nabu`），没有 `violet-xxx` 前缀，所以沿用这个习惯。`kodama` 是日语「木霊」，住在树里的小精灵，对应这个项目的形态：一个住在站点里的小生命。已核对：`VOD-Studio/kodama` 未被占用。

包名不随仓库名走，因为包名是对外接口，仓库名只是地址：

| 对象 | 名称 | 核对 |
|---|---|---|
| npm SDK | `@violetjs/pet` | 未被占用 |
| npm CLI | `@violetjs/pet-cli`，平台包 `@violetjs/pet-cli-<os>-<arch>` | 未被占用 |
| crates | `violet-pet-*`（目录与包名现为 `pet-*`，发布前改名） | crates.io 上 `violet-pet-core`、`violet-pet-cli` 未被占用 |

备选（未采用）：`tama`、`hatch`、`mochi`、`wisp`、`violet-pet`。重命名仓库后 GitHub 会保留旧地址的重定向，所以名字选错的代价很低。

## 拆分后的仓库结构

`pet/` 的内容原样成为仓库根：

```
kodama/
├── Cargo.toml  Makefile  README.md
├── crates/            规则核心、存储、素材、签发、schema、CLI、WebAssembly、服务
├── packages/          @violetjs/pet（SDK）、@violetjs/pet-cli（npm 打包）
├── catalog/ docs/     素材清单、参数、版本、分发、协议文档
├── scenario/ scripts/ 三端场景、开发与测试脚本
├── consumers/         外部消费方验收（npm CLI、Node 嵌入、Rust 宿主、TanStack Start、服务）
└── .github/workflows/ ci.yml（由 pet.yml 迁入）、release
```

Violet 里保留：PRD-0036、ADR-0021、活动连接器（#528）、站点挂载（#531）和 `/pet` 演示页。

## 仓库自己的调试

不依赖 Violet。`make help` 列出全部入口，按“从底向上”的层次：

| 想验证什么 | 命令 | 说明 |
|---|---|---|
| 规则对不对 | `make test`；`cargo run -p pet-core --example timeline` | 全部 Rust 测试；快进体验记录 |
| 画得对不对 | `make preview`；`make term` | 全物种字符画；终端里养一只 |
| 像素画长什么样 | Violet 的 `/pet` 图鉴；或 `cargo test -p pet-term --test pixel` | 暂时没有独立预览页，见下文“待办” |
| 协议有没有漂移 | `make schema`、`make schema-check` | 重新生成 schema、TypeScript 类型与能力文档；校验转录与类型测试 |
| 三端一致 | `make three-end` | 原生、浏览器 WebAssembly、Node WebAssembly 逐字节比较 |
| 服务能不能跑 | `make dev`；另一终端 `T=$(make token SUB=alice)` 后 `curl -H "authorization: Bearer $T" localhost:8787/v1/pets/me` | 见下文 |
| 端到端 | `make e2e`、`make e2e-pg` | 真实二进制与 HTTP；后者需要 Docker 的 Postgres |
| 外部消费方 | `make consumers` | npm CLI、Node 嵌入、Rust 宿主、TanStack Start |

### 没有 Violet 也能调服务

`scripts/dev.mjs` 扮演接入方：首次运行在 `.dev/`（已忽略）里生成发行者密钥、三个独立的服务密钥和环境，然后 `make dev` 起服务、`make token` 以任意 `sub` 签发断言并换取访问令牌。要对着真实接入方调，`PET_DEV_TRUST_KEY=<对方公钥> node scripts/dev.mjs init --force` 让服务信任对方的公钥而不是模拟发行者。已验证：本机从零生成、起服务、换令牌、领取均正常。

## 开发阶段与 Violet 联调

三种方式，按开发所处阶段选：

| 阶段 | 做法 | 适用 |
|---|---|---|
| 1. 本机源码联调（现在就能用） | 两个仓库并排检出。在 Violet 的 `web/` 里 `PET_REPO=../kodama pnpm pet:sync --watch`，另开 `make dev`。改 Rust 后自动重建并同步，Vite 热更新 `/pet` | 同时改宠物与页面 |
| 2. 已发布包 | 首次 npm 发布后，Violet 的 `web/package.json` 依赖固定版本的 `@violetjs/pet`，`/pet` 页改为直接从包导入，删除 `pet:sync` 与忽略的 `sdk/` 目录 | 日常开发与生产 |
| 3. 服务联调 | `PET_DEV_TRUST_KEY` 设为 Violet 开发环境的断言公钥后启动 `kodama` 服务；Violet 连接器（#528，**尚未实现**）配置服务地址与签名密钥 | 活动结算与奖励 |

阶段 1 的细节：

- `pnpm pet:sync` 默认用本仓库的 `../pet`；`PET_REPO` 指向独立检出；`PET_SDK_DIST` 跳过构建、直接拷贝已有产物（例如从 CI 下载的构建）。
- `--watch` 监听 `crates/` 与 `catalog/` 下的 `.rs`、`.json`、`.toml`，改动后 400ms 去抖重建。已验证真实改动会触发重建并同步。
- 产物写到 `web/src/features/pet-demo/sdk/`，已被 git 与 biome 忽略，未同步时页面提示执行命令，构建不会失败。

阶段 3 的契约保持：ADR-0021 留在 Violet；`kodama` 的服务端到端测试扮演 Violet，Violet 的连接器测试将来以固定版本的 `kodama` 服务镜像为对端。双方只共享契约（断言格式、活动事件、错误码），不共享代码，因此版本对不上时是契约测试失败，而不是联调时才发现。

## 执行步骤

### 为什么要从 PR 的原始提交取早期历史

PR #516 是 squash 合并，`release/2.0` 上 `pet/` 的早期历史只有一个压缩提交。PR 的原始头部仍保存在 GitHub 的 `refs/pull/<n>/head`，从那里拆能保留历史。PR #541 用 merge commit 合并后，之后的历史是原子提交，不需要再重放。

已验证（只在本地，未推送）：把 PR #535 的提交重放到 `refs/pull/516/head` 上，再对 `pet/` 做 subtree split，得到 **34 个提交**，文件树与当时的 `pet/` 逐文件一致，不含 `web/`、`api/`、`.github/`。

```sh
# 1. 取得 #516 的原始头部（squash 前的提交）
git fetch origin refs/pull/516/head:refs/tmp/pr516

# 2. 在临时 worktree 里把之后的 pet 相关提交重放到它上面
git worktree add -b tmp/full-history ../kodama-split refs/tmp/pr516
cd ../kodama-split
git cherry-pick -X theirs $(git rev-list --reverse <#516 的合并提交>..origin/release/2.0 -- pet)

# 3. 校验文件树一致（输出必须为空）
git diff --stat tmp/full-history origin/release/2.0 -- pet

# 4. 拆出 pet/ 的历史
git subtree split --prefix=pet tmp/full-history -b kodama-split

# 5. 推到新仓库（需要先由有权限的人创建 VOD-Studio/kodama）
git push git@github.com:VOD-Studio/kodama.git kodama-split:main
```

`-X theirs` 可能掩盖冲突，所以第 3 步的树比较不能省。

## 随新仓库迁出

| 内容 | 位置 |
|---|---|
| 规则核心、存储、素材、签发、schema、CLI、WebAssembly 包装、服务 | `pet/crates/` |
| SDK 与 CLI 的 npm 打包 | `pet/packages/` |
| 素材清单与参数文档 | `pet/catalog/`、`pet/docs/` |
| 场景、脚本、外部消费验收、开发入口 | `pet/scenario/`、`pet/scripts/`、`pet/consumers/`、`pet/Makefile` |
| 检查工作流 | `.github/workflows/pet.yml` 迁入新仓库；`pick-runner.yml` 一并迁移或去掉自托管优先逻辑 |

## 留在 Violet

PRD-0036、ADR-0021、CONTEXT 中的术语、Violet 活动连接器（#528）、主页挂载（#531）、`/pet` 演示页与 `pet:sync`。迁出后删除 `pet/` 与 `pet.yml`，PRD 中的路径引用改为新仓库链接。

## 迁移清单

- [ ] 合并 PR #541（merge commit），其中已含像素画风与开发入口
- [ ] 由有权限的人创建 `VOD-Studio/kodama`（可见性、默认分支、保护规则）
- [ ] 按上面步骤拆分并校验树一致
- [ ] 新仓库配置 CI：安装 `wasm-bindgen-cli@0.2.129`、Postgres 服务、Chrome；`RUNNER_STATUS_TOKEN` 与 `SELF_HOSTED_RUNNER` 是否沿用另议
- [ ] 新仓库配置 release-please（独立版本，不再牵动 Violet 的发版）
- [ ] 新仓库首次 CI 全绿后，再从 Violet 删除 `pet/` 与 `pet.yml`
- [ ] 转移下游 issue（#525 至 #540）：`gh issue transfer <n> <新仓库>`；评审类 issue（#518 至 #524）按内容决定留在 Violet 还是迁出
- [ ] 更新 PRD、ADR 与 CONTEXT 中的路径和链接
- [ ] crate 改名为 `violet-pet-*`，npm 与 crates.io 的发布流程与令牌（目前没有任何包发布）
- [ ] 许可文件：`LICENSE` 随仓库根，素材许可另附

## 待办（未做）

- **独立的像素预览页**：目前像素画只能在 Violet 的 `/pet` 看。拆分后建议在新仓库加一个 `apps/demo`（Vite），复用同一批展示组件，并考虑把它们抽成 `@violetjs/pet-react`，让 Violet 的 `/pet` 退化为薄封装。这是一次独立的设计与提交，不应混进拆分本身。
- **README**：新仓库根的 README 在拆分时写，内容以本文“仓库自己的调试”为骨架。
- **阶段 3 的连接器**（#528）与 Violet 开发公钥的来源还没有实现，上文只是约定。

## 不在本文范围

仓库创建、发布令牌与组织权限，这些需要有权限的人决定与操作。
