# Changelog

本项目所有重要变更记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

v2.0.0 之前手工维护；v2.0.1 起由 [release-please](https://github.com/googleapis/release-please) 自动维护。分类由 `release-please-config.json` 的 `changelog-sections` 按 Conventional Commit type 归类。

## [2.4.6](https://github.com/VOD-Studio/violet/compare/v2.4.5...v2.4.6) (2026-08-06)


### 修复

* **deploy:** npm registry 换国内镜像源 ([#89](https://github.com/VOD-Studio/violet/issues/89)) ([fa44bd3](https://github.com/VOD-Studio/violet/commit/fa44bd312db93495ba6ffc7e218f200b9f1b7624))

## [2.4.5](https://github.com/VOD-Studio/violet/compare/v2.4.4...v2.4.5) (2026-08-06)


### 修复

* **deploy:** 调大 pnpm 下载超时容忍慢链路 ([#87](https://github.com/VOD-Studio/violet/issues/87)) ([6fa555b](https://github.com/VOD-Studio/violet/commit/6fa555b8647d1ef924b55f1cfcaad96ec3246af3))

## [2.4.4](https://github.com/VOD-Studio/violet/compare/v2.4.3...v2.4.4) (2026-08-06)


### 新增

* **editor:** 源码模式改用 CodeMirror 6 替换滚动镜像 ([309e901](https://github.com/VOD-Studio/violet/commit/309e90111d65d72a8f9cd3c4b991c6bd93cf10fb))


### 修复

* **admin:** 文章编辑器移动端布局适配 ([9ccb88f](https://github.com/VOD-Studio/violet/commit/9ccb88fab3be5d0a7b2a2d99e9c4ade010cbcb61))
* **admin:** 文章设置移动端改侧滑抽屉与工具栏排版 ([cc7ec1f](https://github.com/VOD-Studio/violet/commit/cc7ec1f50d732f696029f8dd2fa78fdbf561acd4))
* **admin:** 移除桌面端冗余的文章设置按钮 ([7f14136](https://github.com/VOD-Studio/violet/commit/7f14136f9deaffa1174a5b20207db8593ccf007f))
* **diagram:** mermaid 渲染临时容器改为离屏挂载 ([ff13782](https://github.com/VOD-Studio/violet/commit/ff13782861beeae571158f29124616cc7c63d389))
* **editor:** 源码模式滚动镜像撑开页面产生滚动条 ([6dcb797](https://github.com/VOD-Studio/violet/commit/6dcb7977fdb707c60b70a24d53b631a6a647989f))
* **editor:** 源码模式移动端滚动定位修正 ([86e68a3](https://github.com/VOD-Studio/violet/commit/86e68a30f7cb28dc91befddcb2ae4cdbcb6e40eb))
* **editor:** 编辑器源码模式滚动与移动端布局修复 ([a050496](https://github.com/VOD-Studio/violet/commit/a0504961fb78aef6315aca47fcfaac87c2b1b899))


### 内部维护

* **release:** 强制本次发版为补丁版本 2.4.4 ([4e568a0](https://github.com/VOD-Studio/violet/commit/4e568a0eb59b36300879977c93541a676b0105d7))

## [2.4.3](https://github.com/VOD-Studio/violet/compare/v2.4.2...v2.4.3) (2026-08-06)


### 修复

* **admin:** 后台权限管理修复与 superadmin 语义化重构 ([#81](https://github.com/VOD-Studio/violet/issues/81)) ([591b079](https://github.com/VOD-Studio/violet/commit/591b0794b304316f0fcbedef4e32a0a9f0623665))

## [2.4.2](https://github.com/VOD-Studio/violet/compare/v2.4.1...v2.4.2) (2026-08-05)


### 修复

* **更新日志:** 页面重设计：版本目录导航与阅读位置高亮，移动端横向版本条 ([#77](https://github.com/VOD-Studio/violet/pull/77))
* **更新日志:** 条目清洗与按模块分组——裸链接、任务号不再显示，同模块变更聚合展示
* **更新日志:** 移动端时间线对齐与徽章样式统一

## [2.4.1](https://github.com/VOD-Studio/violet/compare/v2.4.0...v2.4.1) (2026-08-05)


### 修复

* **部署:** 删除 web Dockerfile 对已移除 .npmrc 的 COPY 引用 ([#74](https://github.com/VOD-Studio/violet/issues/74)) ([1022a44](https://github.com/VOD-Studio/violet/commit/1022a448df41aebb488f6dc72eabe17ba8879bba))

## [2.4.0](https://github.com/VOD-Studio/violet/compare/v2.3.0...v2.4.0) (2026-08-05)


### 新增

* **图块:** 全屏模态查看 ([#69](https://github.com/VOD-Studio/violet/issues/69))
* **图块:** 移动端双指捏合缩放 ([#68](https://github.com/VOD-Studio/violet/issues/68))
* **图块:** 阅读端导出 SVG / PNG ([#67](https://github.com/VOD-Studio/violet/issues/67))
* **图块:** 缩放平移与交互开关
* **图块:** 加载占位与失败降级重设计
* **图块:** 键盘可访问性与 aria-label 语义化 ([#71](https://github.com/VOD-Studio/violet/issues/71))


### 修复

* **页头:** 导航绝对定位消除左右抖动
* **页头:** 背景常驻修复刷新后非顶部位置背景丢失
* **主题:** 多图块页面切换主题时卡死
* **目录:** 异步内容撑开后重算激活标题
* **目录:** "Contents" 汉化为"目录"

## [2.3.0](https://github.com/VOD-Studio/violet/compare/v2.2.1...v2.3.0) (2026-08-03)


### 新增

* **网站:** 更新日志页 /changelog 与 about 页入口卡片（含骨架屏与错误重试）


### 修复

* **发版:** 更新日志条目去重，去掉 commit hash 引用

## [2.2.1](https://github.com/VOD-Studio/violet/compare/v2.2.0...v2.2.1) (2026-08-02)


### 修复

* **订阅:** 抓取时回填订阅源标题 ([704a52a](https://github.com/VOD-Studio/violet/commit/704a52abbe6b5c26aea032b8ae633593b738b44f))

## [2.2.0](https://github.com/VOD-Studio/violet/compare/v2.1.3...v2.2.0) (2026-08-02)


### 新增

* **announcement:** 公告创建/更新/删除事件（含 ID 回填） ([1f641dd](https://github.com/VOD-Studio/violet/commit/1f641dd307ac3b9b05ea01854bda6a3ba51d13b7))
* **api-token:** PAT 签发/吊销审计（凭据生命周期） ([378c437](https://github.com/VOD-Studio/violet/commit/378c437b044b41b9c7d8248b778807f2e848d4e7))
* **audit:** append-only AuditEventPO + EventStore GORM 实现 ([b623e6f](https://github.com/VOD-Studio/violet/commit/b623e6f27d4da20cf4d18d5e23272856a8803226))
* **audit:** AuditEvent JSON 序列化 + 查询筛选（ListFiltered + Query 用例） ([e707bd3](https://github.com/VOD-Studio/violet/commit/e707bd340ba4ffbb506356d901b2e1b572fba929))
* **audit:** HTTP handler + /admin/logs 路由 + OpenAPI 重建 ([e7310e4](https://github.com/VOD-Studio/violet/commit/e7310e4d9db71e5ecbecd08d4edaa4a07440fa44))
* **audit:** useradmin 操作发布领域事件（特权操作审计闭环） ([6bc1155](https://github.com/VOD-Studio/violet/commit/6bc1155ad59f4195c1eacc510711d9a349b4087e))
* **audit:** 审计订阅者消费领域事件写入 audit_events ([0887583](https://github.com/VOD-Studio/violet/commit/088758341ae0d032e6c5fb5414e2407fd7aea774))
* **audit:** 操作日志模块推倒重做——事件驱动审计基础设施 ([4e354c2](https://github.com/VOD-Studio/violet/commit/4e354c2c3a2a23b5469144b0727e008d98c75ffc))
* **audit:** 数据库迁移 064 drop audit_logs + 065 create audit_events ([240bc63](https://github.com/VOD-Studio/violet/commit/240bc63fb94cc2023865c5747fa276f59fc0afb6))
* **audit:** 结构化 AuditEvent + 受控 Action 枚举 ([5df5007](https://github.com/VOD-Studio/violet/commit/5df5007c2533781143976e0d4ed5cd67755f9aff))
* **audit:** 订阅者映射 auth 登录/登出/失败事件 ([53795f4](https://github.com/VOD-Studio/violet/commit/53795f48a060e19131476610d35c6fa23c97e88d))
* **audit:** 订阅者映射 comment/PAT/settings 事件 ([aade746](https://github.com/VOD-Studio/violet/commit/aade746848e5a6684d686c79b7f4d2248af15245))
* **audit:** 订阅者映射 post/role/announcement 事件 ([7ec661a](https://github.com/VOD-Studio/violet/commit/7ec661aafe6e90c1a6453780e0ae963858810df5))
* **audit:** 领域事件补全资源快照与 before/after（review [#58](https://github.com/VOD-Studio/violet/issues/58) 修复） ([4d60e4f](https://github.com/VOD-Studio/violet/commit/4d60e4f7c0f75bae5e03a1e0ce45dd4385419adc))
* **auth:** login/logout/verify 发布领域事件（审计接入） ([98298e7](https://github.com/VOD-Studio/violet/commit/98298e78109e9fb641b090646bae1ae915e92b08))
* **comment:** 评论审核审计（Approve/Spam/Delete + 批量） ([9c4579d](https://github.com/VOD-Studio/violet/commit/9c4579d196b203acd7b492ae574fea87708b5eed))
* **eventbus:** EventBus 加 Subscribe 机制，激活领域事件分发 ([268977f](https://github.com/VOD-Studio/violet/commit/268977ff39ab7ab8ee3d6d8a8fae178471e207cb))
* **post:** 文章状态变更事件（发布/归档/回退草稿） ([bfc1d2d](https://github.com/VOD-Studio/violet/commit/bfc1d2d39283251469c07eaf5db36246f9138393))
* **role:** 角色更新/删除事件（含创建事件 ID 修复） ([1968f0e](https://github.com/VOD-Studio/violet/commit/1968f0e653012b3c132c42e73ec99f479a9ea35a))
* **settings:** 站点配置变更审计（SettingsUpdated 事件） ([b002297](https://github.com/VOD-Studio/violet/commit/b0022970b1fd533942d0425d9a44cbac1c5a4815))
* **user:** 用户聚合根状态变更事件（角色/状态/用户名/删除/批量） ([8edfdc7](https://github.com/VOD-Studio/violet/commit/8edfdc775afc42227caf570a1ca8498980f2fe63))
* **web:** 操作日志页适配新 AuditEvent 读模型 ([467b28c](https://github.com/VOD-Studio/violet/commit/467b28c5892848aae55756d32ea8da2c0c5915ae))


### 修复

* **audit:** 空值写入 uuid/jsonb 列失败修复（e2e 发现） ([810d629](https://github.com/VOD-Studio/violet/commit/810d6292b5b3a3d2469133399c706703b9455e23))
* **audit:** 订阅者映射快照字段 + 登录/注册审计修复（review [#58](https://github.com/VOD-Studio/violet/issues/58)） ([e807700](https://github.com/VOD-Studio/violet/commit/e807700357c18221acac3a50d93364672e4d4234))
* **eventbus:** 合并双 bus 实例 + Publish 死锁修复 ([f5704a0](https://github.com/VOD-Studio/violet/commit/f5704a0ac336370eec1cf20a0c7007dc47202d60))
* **role:** 修复权限断言顺序依赖（flaky 测试，CI 撞出） ([d4600f7](https://github.com/VOD-Studio/violet/commit/d4600f73ff5a2df50123e6075743a22b8a6fbcb7))


### 重构

* **audit:** 删除旧 audit 服务/存储/handler 装配（前置 [#49](https://github.com/VOD-Studio/violet/issues/49)/[#11](https://github.com/VOD-Studio/violet/issues/11)） ([c365b68](https://github.com/VOD-Studio/violet/commit/c365b68f9127d76b934df1394b6d08de064aa5e1))
* **audit:** 清理 review 发现的注释违规与读路径 panic ([6a81488](https://github.com/VOD-Studio/violet/commit/6a81488e52af084e0f63a80a862826dd2f1aa960))


### 文档

* **prd:** 沉淀操作日志重构 PRD-0010 ([c0e4a7c](https://github.com/VOD-Studio/violet/commit/c0e4a7c2690b09bf08426a36986f35afa6cd277b))
* **prd:** 重写 PRD-0010 为事件驱动 audit 推倒重做方案 ([aaa1402](https://github.com/VOD-Studio/violet/commit/aaa1402266709d62bc6abbecab344441d9cf9a6c))

## [2.1.3](https://github.com/VOD-Studio/violet/compare/v2.1.2...v2.1.3) (2026-08-02)


### 文档

* **changelog:** 更新描述,移除已删除的 generate-release-notes 引用 ([#36](https://github.com/VOD-Studio/violet/issues/36)) ([215569c](https://github.com/VOD-Studio/violet/commit/215569c2dbd36d34f85b69ce370a382e5a7ee02f))

## [2.1.2](https://github.com/VOD-Studio/violet/compare/v2.1.1...v2.1.2) (2026-08-02)


### 修复

* **ci:** release-please changelog 从 github 原生改为 release-please 原生 ([#34](https://github.com/VOD-Studio/violet/issues/34)) ([e8ad47c](https://github.com/VOD-Studio/violet/commit/e8ad47ca9f49832d8a6b12af14f5d93561f412c1))

## 2.1.1 (2026-08-02)

<!-- Release notes generated using configuration in .github/release.yml at release/2.0 -->

## What's Changed
### 重构
* refactor(domain): TagRepository 接口从 entity.go 拆到 repository.go by @xunrua in https://github.com/VOD-Studio/violet/pull/32
### 其他
* [release] Release notes 切换为 GitHub 原生生成器 by @xunrua in https://github.com/VOD-Studio/violet/pull/24
* [app] main.go 装配层与路由架构治理 by @xunrua in https://github.com/VOD-Studio/violet/pull/23


**Full Changelog**: https://github.com/VOD-Studio/violet/compare/v2.1.0...v2.1.1

## [2.1.0](https://github.com/VOD-Studio/violet/compare/v2.0.4...v2.1.0) (2026-08-01)


### ✨ 新增

* **about:** About 页重设计 + 更新日志（PRD-0009） ([#7](https://github.com/VOD-Studio/violet/issues/7)) ([b718fbe](https://github.com/VOD-Studio/violet/commit/b718fbec809103cec0564a4f06307d9f176a73c6))


### 👷 CI

* **release-please:** 升级 action v4→v5(Node 24 运行时) ([#5](https://github.com/VOD-Studio/violet/issues/5)) ([fa5a5c6](https://github.com/VOD-Studio/violet/commit/fa5a5c6c53482421fa1a64f4144f28bd3b50607b))

## [2.0.4](https://github.com/VOD-Studio/violet/compare/v2.0.3...v2.0.4) (2026-07-30)


### 🐛 修复

* **media:** 补注册 admin 组批量删除路由修复 405 ([#3](https://github.com/VOD-Studio/violet/issues/3)) ([f5eff6f](https://github.com/VOD-Studio/violet/commit/f5eff6fa2413c87c8f8c67fd8a57f24e972e6ad1))

## [2.0.3](https://github.com/VOD-Studio/violet/compare/v2.0.2...v2.0.3) (2026-07-30)


### 📝 文档

* **changelog:** 重写 v2.0.0 段落 ([f378a4d](https://github.com/VOD-Studio/violet/commit/f378a4dfaeff0ea3ab8dec72decee2a204dac8b6))


### 👷 CI

* 升级 setup-node v4→v7 与 pnpm/action-setup v4→v6 消除 Node 20 警告 ([54540df](https://github.com/VOD-Studio/violet/commit/54540dfbafe9c9d025fffa45d10b31222cdf5559))
* 清理旧发版系统残留 + 修复 CHANGELOG 配置 + nginx reload ([96e0099](https://github.com/VOD-Studio/violet/commit/96e00991fd8f984ed90b34f31629074185629568))

## [Unreleased]

> 未发版的改动。push 发版型 commit（feat/fix 等）到 `release/2.0` 后，release-please 自动开 release PR，合并即发版。

## [2.0.2](https://github.com/VOD-Studio/violet/compare/v2.0.1...v2.0.2) - 2026-07-30

### 🐛 修复

- **ci:** release-please 改用 manifest 配置文件(v4 不再支持内联参数) ([e8218cf](https://github.com/VOD-Studio/violet/commit/e8218cf6075d557f870219850f4d0ea41a75b69a))
- **ci:** release-please 用 PAT 绕过组织 GITHUB_TOKEN 创建 PR 限制 ([2ce1386](https://github.com/VOD-Studio/violet/commit/2ce1386843c7122320651562226c43116837f6f4))

## [2.0.1] - 2026-07-30

CI/CD 基础设施修复版本。rebrand（mimo-blog → violet）后遗留的部署链路不一致问题集中修复，并正式接入 release-please 自动发版与 self-hosted runner 自动部署。

### 🐛 修复

- **CI 镜像名统一**：deploy.yml 与 docker-compose.ci.yml 的镜像名从 `blog-api` 统一为 `violet-api`，与 docker-compose.prod.yml 对齐（rebrand 时漏改 CI 路径导致手动/CI 部署镜像名不一致）
- **网络名规范化**：`blog_network` → `violet_network`（mimo-blog 迁移残留），同步 patch-nginx-api.sh 与部署文档
- **CORS 启动门禁**：docker-compose.prod.yml 新增 `CORS_ALLOWED_ORIGINS` 强制检查（compose `:?` 语法）与 `COOKIE_SECURE=true` 生产安全基线

### ♻️ 重构

- **配置架构收敛**：配置链收敛为 `env > .env > config.yaml > 默认值` 单链，部署目录收敛到根 `.env` 单一来源（api/.env 废弃），config.yaml 入库随镜像分发
- **环境变量架构**：根 `.env.example` 成为唯一模板，启动时 tabwriter 对齐打印 50 项配置来源

### 👷 CI

- **release-please 自动发版**：push release/2.0 自动开 release PR（含 CHANGELOG 段落），合并即打 tag 触发部署；PAT 绕过组织 GITHUB_TOKEN 创建 PR 限制
- **deploy.yml 扩展**：支持 api+web 原子部署，新增 web 镜像构建 + sync-client 静态资源同步 + web 健康检查；`component` 输入支持单组件回滚（api/web/both）
- **self-hosted runner**：接入 GitHub Actions self-hosted runner（标签 `rua`，root 身份），本地 podman-docker 兼容层让 CI 用标准 docker 命令
- **actions/checkout v4 → v7**：消除 Node 20 弃用警告
- 废弃本地 `scripts/release.sh` + `make release*` + commit-and-tag-version 依赖，发版统一走 release-please

## [2.0.0] - 2026-07-30

violet（原 mimo-blog）仓库迁移到 VOD-Studio 后的首个正式 release，沉淀了从项目脚手架到完整博客平台的全部开发成果（2093 个 commit）。这是一个全栈博客平台的成型版本。

### ✨ 新增 — 核心平台

- **文章系统**: 基于 Tiptap 的富文本编辑器（bubble menu、代码块高亮、封面图、Markdown 导入导出）、文章 CRUD、回收站、草稿与发布流程
- **评论双轨制**: 底部匿名留言板 + 文内批注，双轨认证与匿名配额（黑洞 + 验证码）
- **用户与权限**: 角色 + 权限树管理、超级管理员、OAuth 登录（Google / GitHub）、PAT 个人访问令牌
- **素材管理**: 媒体库（分片上传、视频封面截取、PDF/音频/图片预览）、素材选择器

### ✨ 新增 — 后台管理

- **管理控制台**: DataTable 全家桶（分页、批量操作、CSV 导出）、服务器监控面板、操作日志（audit）、站点设置、公告、标签、项目管理
- **侧边栏导航**: 品牌区、菜单分组、激活指示条、收起模式

### ✨ 新增 — 高级功能

- **MCP 集成**: 文章/评论检索 tool、匿名公开只读 server（violet-reader）、客户端接入面板与配置生成
- **RSS 订阅**: 订阅源管理、定时抓取调度器、Feed 解析与去重
- **图块与流程图**: Mermaid 流程图渲染、可运行代码块沙箱执行（python/node/go/rust/bun）
- **SEO 与发现**: sitemap、canonical URL、OpenGraph meta、转载来源标记

### ♻️ 重构 — 架构演进

- **认证架构**: opaque session（Redis 后端）+ CSRF double-submit，公开页 SSR 直出
- **路由**: 迁移到 `@tanstack/react-router`，类型安全路由树 + `beforeLoad` 守卫
- **后端 DDD**: 按领域划分四层（domain/application/infrastructure/interfaces），wire 依赖注入
- **SSR**: TanStack Start + Vite，`server.mjs` 桥接 node:http，nginx 直接服务静态资源

### 👷 部署

- 生产 docker-compose（postgres + redis + api + web SSR），nginx-proxy 反代 + Let's Encrypt
- self-hosted runner 本地构建，podman-docker 兼容层

## [1.0.1] - 2026-06-16

> 此 tag 在仓库迁移时丢失，内容为迁移前的早期版本。详见迁移前的历史仓库。

### 修复
- **web**: 修复 `$RefreshSig$ is not defined` (pnpm hoist 导致 React Fast Refresh
  preamble 注入失败) — [9dc66ae](https://example/9dc66ae)
- **web**: 降级 `@vitejs/plugin-react` v6→v5，适配 Fast Refresh preamble — [0753132](https://example/0753132)
- **web**: 降级 Vite v8→v7（v8 为前沿版本，plugin-react 未完全适配），
  彻底解决 `$RefreshSig$ is not defined` 问题 — [c751227](https://example/c751227)

> 补丁版本，不含功能变更。

## [1.0.0] - 2026-06-16

### 重构 — DDD 架构迁移（P0-P3）

#### P0 致命修复与安全加固
- **安全**: 移除 docker-compose 与 .env.example 中的硬编码数据库凭据 `super@123`，
  改为 `${VAR:?msg}` 必填校验
- **基础设施**: 修复 Makefile 死引用 `load-config.sh`；新增 `cmd/migrate` 迁移 CLI；
  数据库连接池配置（MaxOpenConns/MaxIdleConns/ConnMaxLifetime）
- **可观测性**: 新增 RequestID 中间件，日志带 `request_id` 字段打通链路追踪
- **前端**: 开启 TypeScript strict 模式；修复 `adminLoader` 重定向失效；
  修正 Redux→Zustand 文档失真

#### P1 DDD 架构奠基
- **领域层**: `internal/domain/` 四层骨架（shared 基类 + user/role/permission 聚合），
  AggregateRoot/DomainEvent/DomainError/ID/Timestamps 完整基础设施
- **应用层**: `internal/application/` CQRS command/query 用例 + EventBus/UnitOfWork 端口
- **基础设施层**: `internal/infrastructure/` GORM repository + 进程内事件总线
- **接口层**: `internal/interfaces/` HTTP handler + 统一错误翻译中间件
- **依赖注入**: 引入 google/wire 编译期代码生成
- **前端**: 路由 React.lazy 懒加载 + ErrorBoundary + env 集中化
- **工程化**: .editorconfig + .golangci.yml + LICENSE(MIT) + README + CONTRIBUTING +
  纯 shell Git 钩子（pre-commit gofmt）
- **包管理**: 迁移到 pnpm，修复 npm workspace 探测 bug

#### P2 全业务模块 DDD 迁移
- **9 个模块**全部迁移到 DDD 四层架构:
  - user/auth: JWT(ES256) + Redis(refresh token/验证码) + 9 CQRS 用例
  - role/permission: RBAC 权限系统 + 33 预定义权限常量
  - post: 文章状态机(draft/published/archived) + slug 唯一性 + 标签关联
  - comment: 物化路径嵌套(depth≤4) + JSONB 图片 + emoji 反应
  - announcement/project: 简化 DDD(CRUD 合一)
  - emoji/music/upload: 完整 domain + GORM repository
- **全 GORM AutoMigrate**: model struct 即 schema，废弃 sqlc 手写 SQL
- **测试**: 26 domain 单测 + 20 集成测 + 16 application mock 测 + 16 前端单测
- **影子路由**: DDD 路由通过 `/ddd/` 前缀与旧路由并存运行
