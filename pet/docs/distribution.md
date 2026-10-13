# 包名、许可与发布形态（R-08）

#524 的评审输出。「已验证」指有脚本或 CI 覆盖；「计划」指决定了但还没有产物。

## 包名

| 产物 | 名称 | 状态 |
|---|---|---|
| Web / Node SDK | `@violetjs/pet`，终端嵌入在子路径 `@violetjs/pet/terminal`，schema 在 `@violetjs/pet/schema.json` | 已验证（tarball 外部消费） |
| 命令行 | `@violetjs/pet-cli` | 已验证 |
| 平台二进制 | `@violetjs/pet-cli-<os>-<arch>`，由主包的可选依赖拉取 | 仅 darwin-arm64 经 `npm-cli.sh` 验证；CI 上验证 linux-x64 |
| Rust crate | 发布时使用 `violet-pet-*` 前缀（如 `violet-pet-core`），不用泛化的 `pet-*` | 计划；2026-10-13 核对 `pet-core`、`violet-pet-core` 均未被占用，发布前须再核对 |

沿用 `@violetjs/<功能名>` 惯例，不带 `-sdk` 后缀。

## 许可

| 对象 | 许可 | 依据 |
|---|---|---|
| 代码（crates、SDK、CLI、服务） | **MIT** | 仓库根与 `inkline`、`react-tweet`、`ui` 均为 MIT；包与 workspace 已声明并随包携带 `LICENSE`（已验证） |
| 美术素材（形象、动作、部件） | **CC BY 4.0** | 允许商用与修改，要求署名；与代码许可分开声明。**这是建议值，目前没有任何正式素材，未落地** |
| 第三方素材与字体 | 逐项记录来源、修改与许可（如 OFL） | PRD 要求；素材清单未建 |
| AI 参与制作的素材 | 在清单中标明，且不得含不可再分发的内容 | PRD：AI 只制作待校验资源 |

素材包独立于代码包版本发布，素材目录的每一项带稳定标识、版本与许可字段。

## 版本

- npm 的 SDK、CLI 主包与全部平台包**同步版本号**（lockstep），避免主包与二进制不匹配。
- `rules_version` 独立于包版本（见 `versioning.md`）。包的主版本变化不改变既有个体；提升 `rules_version` 是不兼容规则变更，需要保留旧派生并发布迁移说明。
- 线上协议以 schema 为准；新增命令与字段是次版本，删除或改变语义是主版本，由 `check-schema.sh` 把生成物差异暴露在 PR 里。

## 支持的平台

| 目标 | 状态 |
|---|---|
| WebAssembly（浏览器、Node） | 已验证：Chrome、Node 22/23、TanStack Start 生产构建 |
| darwin-arm64 | 已验证（本机） |
| linux-x64 | 已验证（官方 runner 上的 CI） |
| darwin-x64、linux-arm64、win32-x64 | 计划，尚未交叉编译，也没有验证。Windows 的终端处理（备用屏、信号、resize）与 Unix 不同，需要单独实现与验证 |

缺少对应平台包时，启动器给出可操作的错误并提示从源码构建；不静默回退。

## 发布形态

- 目前没有任何包发布到 registry，`0.0.0` 仅用于本地验收。
- 发布沿用仓库已有的 npm 发布工作流模式（`publish-npm.yml` 校验清单、测试与外部消费后再发布）；宠物拆为独立仓库后在新仓库建立等价流程，须使用带 provenance 的发布并核对 `NPM_TOKEN`。
- Skill 与 `docs/capabilities.md` 随 SDK 包分发，保证外部 agent 不依赖本仓库（能力文档已随包，Skill 本体见 #533）。

## 对应验收

外部开发者能照做的接入与升级说明：安装、初始化、命令、升级与不支持平台的行为已在 SDK 与 CLI 的验收脚本中体现；面向用户的接入文档属于 #533 的 Skill 与文档工作。
