# violet (blog-project)

全栈博客平台 monorepo。

## 架构与代码边界
- **后端 (`api/`)**: Go 1.26, Chi 路由, PostgreSQL 16, Redis 7。
  - **关键**: 后端为 DDD 单一架构: `internal/{domain,application,infrastructure,interfaces,app}`(旧 handler/service/repository 分层已移除)。依赖注入为 `app/` 下手工容器装配(`*Container` + `container.go` 聚合,不使用 wire)。
- **前端 (`web/`)**: React 19, Vite, Tailwind CSS v4。
  - **关键**: 使用 **`pnpm`** 作为包管理器，**切勿使用 `npm` 或 `yarn`**。
  - 状态管理: Zustand + TanStack Query。

### 架构耦合约束

> 这是**代码组织原则**,不是 commit 拆分规则。规则 1(公共组件单独提交)管「commit 怎么拆」,本节管「代码该放哪一层」。两者分开理解。

- **前端公共层不夹带 feature 业务逻辑**。`web/src/shared/`(`ui`/`lib`/`api`/`config`/`server`/`vendor`)只放跨 feature 通用件,不写 `posts` / `comments` / `editor` 等特定 feature 的业务逻辑。FSD 分层(`shared` → `entities` → `features` → `widgets`)约束依赖方向,`shared` 不反向依赖 `features`。
- **后端各层各司其职**:领域逻辑进 `domain`,用例编排进 `application`,基础设施细节进 `infrastructure`,HTTP 适配进 `interfaces`;`internal/middleware/` 只放通用横切中间件(auth/cors/csrf/ratelimit 等)。通用基础设施(错误码、observability、通用中间件)不夹带具体业务实体逻辑。
- **判断「是否公共」看是否被多个 feature/domain 引用**,而非位置。某 feature 私有逻辑一旦被第二个 feature 复用,应先 `refactor: 将 X 从 features/A 提到 shared/` 落定代码归属(提交规则见规则 1),再在新 feature 接入。

## 开发流与命令 (Makefile)
所有核心操作都通过根目录的 `Makefile` 统管：
- **启动本地开发**: `make dev` (一键启动 Postgres、Redis、API 和 Web)
- **数据库迁移**: `make migrate` (使用 golang-migrate)

### 后端 (`api/`) 须知
- **环境依赖**: 后端需要 Go 1.26。本机无 Go 时不擅自安装,按 `.agents/skills/api-toolchain` 的流程问用户一次并记住决定(本地安装或容器执行)。
- **测试**: `make api-test` (本机无 Go 时按上方容器方式执行,下同)
- **代码检查**: `make api-lint` (使用 golangci-lint)

### 前端 (`web/`) 须知
- **代码检查与格式化**: 使用 **Biome** (非 ESLint/Prettier)。命令: `make web-lint` 和 `make web-format`。
- **类型检查**: `make web-typecheck`
- **测试**: `make web-test`
- **Tailwind CSS v4**: 支持任意数字值简写 (例如 `max-w-50` = 200px 替代 `max-w-[200px]`)。详见 `tailwind-canonical-classes` skill。

## 分支命名

每个新任务 / feature 先从 `release/2.0` 新建分支完成，不在 `release/2.0` 上直接开发。

格式:**`<type>/<scope>-<简述>`**

- **type** 对齐 Conventional Commits:`feat` / `fix` / `chore` / `docs` / `refactor` / `style` / `test` / `perf` / `hotfix`。
- **scope** 指向最内层模块(同提交 scope 规则):前端 (`posts`/`editor`/`auth`/`comments`)、后端 (`handler`/`service`/`domain`/`repository`)、或文件 / 区域名 (`readme`/`ci`/`deps`/`deploy`)。改动难以定位到单模块时可省略 scope。
- 全小写,`/` 分段,`-` 连词。无空格、无大写、无特殊字符。
- 简述用英文或拼音,短而清晰。

✅ 正确:
- `feat/post-slug-pinyin`
- `feat/front-end-redesign`
- `fix/handler-search-encoding`
- `docs/deploy`
- `chore/deps-bump`

❌ 错误:
- `feature/这是一个很长的中文分支名`(冗长 + 中文)
- `update`(无 type 无 scope)
- `Fix/Login`(大写)
- `new-feature`(能定位到模块时该写 scope,而非泛称)

### PRD / issues 与分支的关系

**PRD、issues 属于 feature 分支的一部分,不是独立任务,不单独建文档分支。** 这是「每个新任务先建分支」规则在文档场景下的具体含义,容易误判,单列一节。

- 一个 feature 的完整生命周期(PRD 起草 → PRD 迭代 → issues 拆分 → 各 issue 实现)都在**同一个 feature 分支**上推进。PRD 和 issues 是该分支的早期 commit,实现代码是后续 commit。
- **不存在「为写 PRD 单独建 `docs/xxx-prd` 分支」这种事**。写 PRD 的第一步就是建 feature 分支(如 `feat/scrape-mcp`),PRD 作为该分支第一个 commit。
- PRD 与 issues 可同 commit(如 `docs(prd): 沉淀 X PRD 与 issue 拆分`),也可分开(`docs(prd): ...` + `docs(issues): ...`),按改动体量决定。
- 各 issue 的**实现**仍可从 feature 分支再叉子分支(可选),也可直接在 feature 分支上按原子提交规则提交。子分支与否不影响「PRD 在 feature 分支上」这一前提。
- 参考历史:`feat/web-session-cleanup` 分支从 `docs(prd): 沉淀 PRD-0001` 起步,经历多次 PRD 迭代 + issues 拆分,最后到 `feat(web): ...` 实现代码,全部在同一分支。

**判定方法**:如果这份 PRD/issues 服务于一个具体的 feature,它就属于该 feature 分支;只有跨 feature 的纯架构/流程文档(如本 AGENTS.md、ADR)才考虑独立 docs 分支。

## Agent skills

### Issue tracker

GitHub Issues 为主(`gh issue create`),`gh` 不可用时降级到本地 markdown(`docs/issues/<prd-id>/`)。外部 PR 不进 triage 队列。详见 `docs/agents/issue-tracker.md`。

### Triage labels

五个 canonical triage 角色(needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix),label 字符串与角色名一致,wontfix 复用 GitHub 自带。详见 `docs/agents/triage-labels.md`。

### Domain docs

Single-context:根 `CONTEXT.md` 单文件统管所有域(认证/文章/公告),`docs/adr/` 放 auth 系列 ADR。详见 `docs/agents/domain.md`。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->

## 提交流程规范

- 每次完成一个任务或一个功能点都要进行 Git 提交。
- 提交信息必须使用**中文**，并严格符合历史的 Conventional Commits 格式，例如 `feat(api): 添加新功能`、`fix(web): 修复页面 bug`。
- **subject 只概括一个主要变更**，祈使句、简洁（50 字符内为宜）。一个 commit 含多个独立变更时应拆分提交，subject 禁止用 `+` / `、` 等符号堆砌多个要点（次要变更的细节写进 body）——subject 写不下说明改动太杂，回归「三问」拆 commit。**该约束同样适用于 issue 标题与 PR 标题**：一律不用 `+` 连接多要点，用「与」「并」等连接词或拆分。
- **scope 指向最小改动单元**，不要叠加冗余前缀。scope 的作用是区分同一仓库里不同模块的改动，当改动集中在一个子模块时，scope 只写最内层模块名。
  - ✅ 正确：`fix(handler): 搜索接口 URL 编码修复`
  - ✅ 正确：`feat(observability): 接入 OTel trace_id 注入`
  - ❌ 错误：`fix(api/handler): 搜索接口 URL 编码修复`（api 是冗余前缀）
  - ❌ 错误：`feat(api): 登录能力`（改动在多个子模块时，用最贴近的模块名而非项目名）
  - 判断方法：如果去掉 scope 里的某一段，剩下的仍然能准确定位改动位置，那被去掉的那段就是冗余的。
- **body 用 bullet points 列出改动事实**，不写散文、不夹带主观评判。详细的决策过程应写在 PR 描述或 ADR。
- **请勿推送**，仅在本地进行 commit。

### 原子性

通用判据(三问 + 反对过度拆分 + draft 阶段宽松)见 [VOD-Studio/kite AGENTS.md](https://github.com/VOD-Studio/kite/blob/main/AGENTS.md) 「原子性」章节,两仓库共用同一套实践,不在此复制(单一真相,避免双份漂移)。

violet 是 monorepo(`api/` + `web/`),额外两条:

- **前后端必须分离提交**。同一需求同时改到 `api/` 和 `web/` 时,必须拆成多个 commit——前后端发布节奏、review 人、回滚影响面都不同。
- **公共组件倾向单独提交**。`web/src/shared/ui` 下的通用组件,或被多个 feature 引用的实体/接口/hooks/utils 的改动,**能独立 revert 时就单独提交**(如修 bug、加通用能力)。但当公共组件改动与某 feature 强耦合(如为该 feature 加了专属 prop,改完其他地方用不了)时,按三问判据合并——拆开后 revert 会坏构建的,不拆。feature 内部组件(`features/posts/ui/*` 等)属于该 feature 私有,按职责分组提交即可,不必每个组件单独拆。判断「是否公共」看**是否被多个 feature 引用**——私有逻辑一旦被第二个 feature 复用,应先 `refactor(shared-ui): 将 X 提到 shared/ui` 单独提交,再在新 feature 接入。

## 代码注释规范

注释只写代码**无法自表达**的信息。代码已说明的,注释复述就是噪音——维护时注释与代码双线漂移,先信谁都是坑。

### 无效注释(禁止新增,存量逐步清理)

**1. 复读签名**——把类型名/函数名/字段名用中文重述一遍,没补充任何新信息。

```go
// ❌ AuditContainer 操作日志模块容器
type AuditContainer struct { ... }
// 类型名 AuditContainer 已说明它是 audit 模块的容器,注释只是翻译了一遍。

// ❌ NewAuditContainer 装配操作日志模块
func NewAuditContainer(db *gorm.DB) *AuditContainer {
// 函数名 NewAuditContainer 已说明它构造这个容器,注释是复读。

// ✅ Handle 执行邮箱验证
func (h *VerifyEmailHandler) Handle(...) {
// Handle 是泛词(不知道做什么),"邮箱验证"补充了签名没有的信息——有效。

// ✅ List 分页查询日志
func (s *Service) List(...) {
// List 是泛词(不知道 list 什么),"日志"补充了签名没有的信息——有效。
```

判定:名字本身是否已自解释?是 → 注释复读,无效。名字是泛词(Handle/List/Get/Update),注释补充了"做什么/查什么" → 有效。

**2. 短函数里的废话分隔标签**——函数几行长,`// --- XXX ---` 比代码还多。

```go
// ❌
func Run(ctx context.Context, cfg *config.Config) error {
    // --- 基础设施 ---
    infra, cleanup := InitInfra(ctx, cfg)
    defer cleanup()

    // --- 模块容器 ---
    container, cc, err := NewContainer(...)
```

边界:**长文件**(如 300+ 行的 service)用 `// --- 输入/输出 DTO ---` `// --- CRUD 用例 ---` 分段有导航价值,保留;**短函数**(几十行)的分隔标签纯噪音,删。

**3. 设计论证当注释**——把 why、框架原则、历史决策塞进注释。

项目 AGENTS.md「提交信息风格反例」已规定:详细的决策过程应写在 PR 描述或 ADR,代码注释和 commit body 都不该写散文。同理:

```go
// ❌ seed 调用 application use case 合规,但 input DTO 构造由模块自治。
// ❌ 符合 ABP「seed contributor 封装在模块内」原则。
// ❌ 此前 role 模块用 google/wire 装配...为统一 DI 方式、消除 wire 孤岛...
```

这些是「为什么这么设计」的论证,属于 PR/ADR,不属于代码。代码注释只管「这段代码现在做了什么、有什么陷阱」,不管「过去为什么这么决定」。

**4. 过期/不准确注释**——重构后没更新,注释指向已被删除的符号或旧的调用方。

```go
// ❌ "由 main.go 调用"    ← 实际已改为 app.NewContainer 调用
// ❌ "从 main.go 抽离"    ← 实际已在 app.Run 内部
```

重构搬代码时,跟着搬的注释要同步改指向。拿不准就删——过期的注释比没有注释更危险。

**5. 一个包多个 package comment**——Go 规范要求一个包**只在一个文件**有 `// Package xxx` 文档。

```go
// ❌ 同一个 internal/app 包下,多个文件各写一份:
// auth_container.go:   // Package app 提供 auth/user DDD 模块的手工 DI 装配。
// container.go:        // Package app 根容器:聚合全部 DDD 模块容器。
// run.go:              // Package app 应用启动入口。
```

包级文档只在**一个文件**保留(通常 `doc.go`,或字母序第一个文件)。其余文件的 `package app` 行不带注释。`go vet`/`revive` 会警告重复。

### 有效注释(保留)

注释值得存在,当且仅当它提供了代码本身没有的信息:

- **非显然陷阱**:`// 返回 error 而非 log.Fatal:Fatal 调 os.Exit 会跳过 defer cleanup,导致连接泄漏。`
- **不明显的业务规则**:`// display 字段创建后不可变更:不同形态语义与必填字段不同,中途切换会数据不完整。`
- **跨模块编排约束**:`// login 只校验凭证返回 userID,session 创建交由 CreateSessionHandler,避免三种登录方式重复 session 逻辑。`
- **魔法值的理由**:`const replyPreviewLimit = 3 // 前端首屏无需为每条顶层发独立请求拉预览。`
- **公开 API 的 godoc**(导出符号的契约文档,调用方靠它理解用法)。

### 自检

写注释前问:这段话是不是在描述代码「做了什么」(代码已说明)?还是「为什么这么做、有什么坑」(代码没说)?前者删,后者留。

### 新增代码强制遵守;存量注释不专门开 PR 清理

新代码(含重构搬移)必须遵守上述规范。存量无效注释**不单独开 PR 清理**(噪音清理不构成可单独 revert 的原子改动),但在**因其他原因改动到该文件时顺手清理**(规则 3 同层按职责拆分的延伸:改到即清)。

### 字段注释规范(struct field)

上一节讲「该删什么注释」,本节讲「该补什么注释」。两者不矛盾:废话注释删掉,关键注释补上。

#### 金标准:领域实体/值对象的每个字段都要注释

`domain/user/entity.go` 的 `User`、`domain/comment/entity.go` 的 `Comment`/`Anchor`、`domain/subscription/entity.go` 的 `Subscription`、`config/config.go` 的全部配置 struct 是项目主流高质量样本。它们的共同点:

```go
type User struct {
    shared.AggregateRoot
    // email 邮箱(值对象)
    email Email
    // username 用户名(值对象)
    username Username
    // ...
    // isBuiltinSuperAdmin 是否为内置超级管理员
    //
    // 区分"内置超管"(系统初始化的唯一超管,通配符权限,靠标志位短路)
    // 与"被委派超管"(被内置超管授予 superadmin 角色的用户,按 role_permissions 表授权)。
    isBuiltinSuperAdmin bool
}
```

- 每个命名字段一行 `// fieldName 中文说明`。
- 嵌入字段(`shared.AggregateRoot` 等)豁免,不注释。
- 语义不显然的字段(如上例 `isBuiltinSuperAdmin`)补多行 why,解释不变量/取值约束/与相邻字段的区分。

#### 强制范围(必须补字段注释)

按对象类型分两档,判定标准是「字段名 + 类型 + tag 能否让调用方推断正确用法」:

**领域实体 / 值对象(`internal/domain/**`):每个命名字段必须补。**

原因:领域对象有不变量、状态机、取值约束、业务语义,代码本身看不出这些。这是项目既有基线(`User`、`Comment`、`Subscription` 均如此),存量未达标的领域 struct(如 `Announcement`、`PAT`、`ExecutionTask`、`Emoji*`、`SiteSettings`、`upload.File`、`stats.*`)改动到该文件时补齐。嵌入字段豁免。

**对外 DTO(application 导出 `*DTO`/`*Input`/`*Output`、handler 导出 `*Request`/`*Response`):只补非自解释字段。**

原因:DTO 是原始类型 + `json` tag 的数据载体,字段名 + 类型 + tag 多数已说清 schema。给自解释字段补注释会沦为复读签名(无效注释第 1 类)。**只补这些:**

- 零值 / nil / 空串的语义(`CanonicalURL *string // nil=原创,非空=转载源 URL`)
- 合法值枚举(`Status string // 'draft'|'published'|'archived'`)
- 单位 / 格式(`Duration uint64 // 微秒`、`PublishedAt string // RFC3339`)
- 引用关系 / 计算口径(`IsAuthor bool // created_by == post.author_id`、`AnnotationCount // 批注数,非评论总数`)
- PATCH 语义(`Interval string // 空串=保留原值`)

判定方法:去掉注释,调用方/前端能否从字段名 + 类型 + json tag 推断出**正确**用法?能 → 不补;不能(有歧义)→ 补。

反例(不需要补,补了就是复读):`Hostname string \`json:"hostname"\``、`TotalBytes uint64 \`json:"totalBytes"\``、`CommentsEnabled bool \`json:"comments_enabled"\``。

#### 豁免范围(不强制字段注释)

以下 struct 字段不要求 `// fieldName` 注释,因为信息已由代码其他部分自表达,补注释反而是噪音:

- **GORM PO 模型**(`infrastructure/persistence/gorm/model/`):字段带 `gorm:"column:xxx"` + `json:"xxx"` tag,列名与类型已自描述。
- **单字段依赖注入容器**(`app/*Container`、`application/*Service`/`*Handler`、`interfaces/http/handler/*Handler`):字段是注入的依赖,构造函数签名已说明,struct 内重复注释即「复读签名」(见无效注释第 1 类)。
- **带 `jsonschema` 描述 tag 的 DTO**(如 MCP tool 参数 struct):tag 里的描述已是字段文档。
- **函数内临时 row struct**(如 GORM 查询的 `row`/`statRow`):局部临时,不暴露。
- **带 `validate` tag 的未导出请求 DTO**:校验规则已由 tag 表达。

#### 写法约定

- 行上注释优先(`// fieldName 说明` 紧贴字段上方一行),与金标准一致。
- 行尾内联注释(`field Type // 说明`)仅用于一句话能说清的简单字段(如 `sourceType string // 'rss' | 'page'`),复杂字段仍用行上多行。
- 注释内容是「这个字段是什么/取什么值/有什么约束」,不是「这个字段叫什么」(后者是复读字段名)。

## PR 与 issue 规范

### Issue 标题格式

用 **`[scope] 描述`**,不要 `vertical: ...`(vertical slice 是拆分方法论,不该暴露在标题)。对齐仓库已有的 `[code-runner] Tn` 系列惯例。**标题禁止用 `+` / `、` 堆砌多要点**,多要点用「与」等连接词或拆分。

- ✅ 正确：`[auth] opaque session 退出码归一`
- ✅ 正确：`[code-runner] T9 部署配置与文档同步`
- ❌ 错误：`vertical: 补全挂载(kit 表驱动...)`(暴露实现方法论,且冗长)

连续任务序列(如 code-runner T1–Tn)带 `Tn` 编号;独立 feature 不带编号。scope 用最内层模块名(同提交 scope 规则)。

### Issue labels

- **默认不加 label**。仅当改动性质明确匹配 GitHub 内置语义 label 时才加(如 `bug`、`documentation`)。
- **禁止加 `ready-for-agent`** 等流程性 triage label——本仓库不跑 AFK agent 拣选流程,此类 label 无信息量(triage 五角色仅用于外部来件的 triage 流转)。

### PR 创建

开 PR 时(`gh pr create`)固定配齐:

- **assignees**:**默认不指定**——不自动加 `@me`。避免发邮件通知,需要时人工在 PR UI 分配。
- **reviewers**:**默认不指定**——不自动艾特 collaborator(邮件通知太烦)。需要 review 时人工在 PR UI 添加。
- **labels**:**默认不加 label**。仅当改动性质明确匹配 GitHub 内置语义 label 时才加(如纯文档加 `documentation`、修 bug 加 `bug`)。**禁止加 `ready-for-agent`** 等流程性 label(对人工 review 无信息量)。
- **base**:指向 `release/2.0`(仓库主开发分支,非 `main`)。
- **关联 issue**:PR 有对应 issue 时,在 body 用 `Closes #N`(或 `Fixes #N`)关键字引用,合并后自动关闭该 issue。纯关联不关 issue 的用普通链接(如 `issue #N`)——两者语义不同,别混用。

### 合并

- **手动合并**,不勾 auto-merge。由人工 review approve 后在 UI 点合并。
- 合并方式:**功能/修复 PR 用 merge commit**(保留分支原子 commit 粒度,`gh pr merge --merge`);**release-please 自动开的 release PR(`chore(release): vX.Y.Z`)用 squash merge**(单 commit,`gh pr merge --squash`)。
- **merge commit 的前提**:分支上每个 commit 必须是 final 形态的 Conventional Commit(无 WIP/中间态/回退 commit)——release-please 会把分支上每个发版型 commit 都写进 CHANGELOG(粒度 = commit 而非 PR),废 commit 会污染 changelog 且无法用 squash 的「只留 PR title」遮丑。
- 已知坑:merge commit 合并时 release-please 会以 PR title 与原始 commit 各记一条导致 changelog 重复条目,`api/internal/application/releases/service.go` 已有去重兜底。
- 合并后:**自动删除分支**(`gh pr merge --delete-branch`,合并即删远程+本地 feature 分支)。

### 版本号

- **按需触发，非默认**。release-please 默认从 commit 类型推导版本号(`feat` → minor, `fix` → patch)。**只有用户明确说「发补丁 / release as patch / 发 patch」时**,才在 footer 加 `Release-As: v<版本>` 锁定为 patch;用户不提就不加,让 release-please 自行推导。
- **做法**:用户要求发补丁时,在合并到 `release/2.0` 的 feature 分支上,最后一个发版型 commit(`feat`/`fix`/`perf`/`refactor`)的 footer 加 `Release-As: v<下个 patch>`。算下个 patch:查最新 tag(`git tag --sort=-v:refname | head -1`),patch +1。
- **minor/major**:同理,用户明确要求时在 footer 写对应版本号(如 `Release-As: v2.9.0`),否则不干预。

