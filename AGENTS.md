# mimo-blog (blog-project)

全栈博客平台 monorepo。

## 架构与代码边界
- **后端 (`api/`)**: Go 1.25, Chi 路由, PostgreSQL 16, Redis 7。
  - **关键**: 后端正在进行 DDD 架构重构，新旧架构并存。
  - 新代码使用 DDD 结构: `internal/{domain,application,infrastructure,interfaces,app}`。依赖注入使用 `wire` 管理。
  - 旧代码使用传统分层: `internal/{handler,service,repository}`（迁移中，请勿混用架构模式）。
- **前端 (`web/`)**: React 19, Vite, Tailwind CSS v4。
  - **关键**: 使用 **`pnpm`** 作为包管理器，**切勿使用 `npm` 或 `yarn`**。
  - 状态管理: Zustand + TanStack Query。

## 开发流与命令 (Makefile)
所有核心操作都通过根目录的 `Makefile` 统管：
- **启动本地开发**: `make dev` (一键启动 Postgres、Redis、API 和 Web)
- **数据库迁移**: `make migrate` (使用 golang-migrate)

### 后端 (`api/`) 须知
- **环境依赖**: 后端需要 Go 1.25。如果当前环境没有安装 Go，`make check` 会提示缺失，但**不要自行安装 Go**，应停下来告知用户并等待其处理。
- **数据库代码生成**: 修改 SQL 查询后，**必须**运行 `make sqlc`。
- **依赖注入生成**: 修改 DDD 的依赖注入项后，**必须**运行 `make wire`。
- **测试**: `make api-test`
- **代码检查**: `make api-lint` (使用 golangci-lint)

### 前端 (`web/`) 须知
- **代码检查与格式化**: 使用 **Biome** (非 ESLint/Prettier)。命令: `make web-lint` 和 `make web-format`。
- **类型检查**: `make web-typecheck`
- **测试**: `make web-test`
- **Tailwind CSS v4**: 支持任意数字值简写 (例如 `max-w-50` = 200px 替代 `max-w-[200px]`)。详见 `tailwind-canonical-classes` skill。

## Agent skills

### Issue tracker

GitHub Issues 为主(`gh issue create`),`gh` 不可用时降级到本地 markdown(`docs/issues/<prd-id>/`)。外部 PR 不进 triage 队列。详见 `docs/agents/issue-tracker.md`。

### Triage labels

五个 canonical triage 角色(needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix),label 字符串与角色名一致,wontfix 复用 GitHub 自带。详见 `docs/agents/triage-labels.md`。

### Domain docs

Single-context:根 `CONTEXT.md` 单文件统管所有域(认证/文章/公告/mimo-music/musicctl CLI),`docs/adr/` 混放 auth 系列 + mimo-music 系列 ADR。详见 `docs/agents/domain.md`。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->

## 提交流程规范

- 每次完成一个任务或一个功能点都要进行 Git 提交。
- 提交信息必须使用**中文**，并严格符合历史的 Conventional Commits 格式，例如 `feat(api): 添加新功能`、`fix(web): 修复页面 bug`。
- **scope 指向最小改动单元**，不要叠加冗余前缀。scope 的作用是区分同一仓库里不同模块的改动，当改动集中在一个子模块时，scope 只写最内层模块名。
  - ✅ 正确：`fix(netease): 搜索接口 URL 编码修复`
  - ✅ 正确：`feat(observability): 接入 OTel trace_id 注入`
  - ❌ 错误：`fix(mimo-music/netease): 搜索接口 URL 编码修复`（mimo-music 是冗余前缀）
  - ❌ 错误：`feat(mimo-music): 登录能力`（改动在多个子模块时，用最贴近的模块名而非项目名）
  - 判断方法：如果去掉 scope 里的某一段，剩下的仍然能准确定位改动位置，那被去掉的那段就是冗余的。
- **body 用 bullet points 列出改动事实**，不写散文、不夹带主观评判。详细的决策过程应写在 PR 描述或 ADR。
- **请勿推送**，仅在本地进行 commit。

### 提交原子性

一个 commit 只做一件完整的事。完整是指：这个 commit 可以被单独 revert、单独 cherry-pick、单独 review，而不会让代码处于中间态或同时影响多个无关模块。

拆分原则按优先级从高到低执行：

1. **公共组件单独提交**
   只有**公共组件**需要单独提交：`shared/ui` 下的通用组件，或被**多个 feature 引用**的实体、接口、hooks、utils，新增、重构、修 bug 都要单独提交。**feature 内部组件**（如 `features/posts/ui/*`、`features/comments/ui/*`）属于该 feature 私有，按职责分组提交即可，**不必每个组件单独拆 commit**。

   ✅ 正确：
   - `feat(web): 封装封面图选择器 Cover 组件`
   - `fix(web): Cover 组件空值时回显异常`

   ❌ 错误：
   - `feat(web): 文章编辑页接入 Cover 并修复空值回显`

   原因：接入页面和修复组件是两件事。混在一起回滚时会把页面改动一起带走。

   判断「是否公共」看**是否被多个 feature 引用**，而非位置。feature 内部组件一旦被第二个 feature 复用，应先 `refactor(web): 将 X 从 features/A 移动到 shared/ui` 单独提交，再在新 feature 接入。

2. **前后端必须分离提交**
   同一需求如果同时改到 `api/` 和 `web/`，必须拆成多个 commit。API 接口变更、Web 接入、类型同步、测试补全都可以各自独立。

   ✅ 正确：
   - `feat(api): 站点设置支持控制 Google/GitHub 登录开关`
   - `feat(api): 站点设置接口返回 OAuth 开关字段`
   - `feat(web): 站点设置页按开关隐藏 OAuth 登录按钮`

   ❌ 错误：
   - `feat: 站点设置支持 OAuth 开关`

   原因：前后端发布节奏、review 人、回滚影响面都不同，混在一起会增加风险。

3. **同层内按职责拆分**
   即使全在前端或全在后端，也要按改动职责拆分：
   - 组件本身改动 vs 页面接入
   - 类型定义改动 vs 业务逻辑改动
   - API client 层改动 vs UI 状态改动
   - 纯样式/排版调整 vs 功能改动

   ✅ 正确：
   - `feat(web): PostEditor 支持代码块高亮`
   - `feat(web): 文章详情页接入代码块高亮`
   - `style(web): 代码块内边距与字体调整`

   ❌ 错误：
   - `feat(web): 代码块高亮接入并调整样式`

4. **修复必须指向具体对象**
   `fix:` 开头的提交要让人一眼看出修了什么。禁止用 `fix(web): 修复若干问题`、`fix(api): 处理一些 bug` 这种笼统描述。

   ✅ 正确：
   - `fix(web): bubble menu 利用滚动容器裁剪避免飘出编辑区`
   - `fix(api): 文章列表分页参数越界时返回空数组而非 500`

   ❌ 错误：
   - `fix(web): 修复编辑器问题`

5. **重构与功能分离提交**
   重命名、移动文件、提取公共函数、调整导入路径等重构操作，如果伴随着功能改动，要先把重构单独提交。

   ✅ 正确：
   - `refactor(web): 将 Cover 组件从 widgets 移动到 shared/ui`
   - `feat(web): 文章编辑页接入 Cover 组件`

   ❌ 错误：
   - `feat(web): 移动 Cover 组件并接入文章编辑页`

6. **测试与实现同组但不混主体**
   为当前改动补测试，可以和实现放在同一个 commit；但跨多个改动的集中补测试要单独提交。

   ✅ 正确：
   - `feat(api): 添加文章发布校验` + body 里说明同时补了单测
   - `test(api): 补全文章仓库的边界场景测试`

### 提交前自检

写完提交信息后，问自己三个问题：

- 这个 commit 如果单独 revert，会不会误伤其他功能？
- 这个 commit 的标题能不能让我三个月后一眼看出它做了什么？
- body 里的每一项改动是否都指向同一个目标？

如果任一答案为否，就再拆分。

### 提交信息风格反例

下面两种提交信息的原子性没问题，但 body 写成散文，夹带主观评判和过多背景说明，同样不合格。

**反例一：把 body 写成设计论证**

```text
fix(web): 用 navigator.locks ifAvailable 实现真正的跨 tab 互斥

此前用 refreshedThisRound 模块级标志判断「本轮是否已刷新」是错的：
模块变量每 tab 独立，跨 tab 不共享，排队 tab 仍看到自己的 false 照样
执行 doRefresh → 触发家族吊销。逻辑自欺欺人。

改用 navigator.locks.request 的 ifAvailable:true：锁被其他 tab 持有时
回调收到 null，该 tab 直接跳过 refresh 返回哨兵。这才是真正的跨 tab
互斥原语——同一 origin 同一时刻只有一个 tab 真正执行 doRefresh。

跳过 tab 重放原请求即可：cookie 跨同源 tab 共享，持锁 tab 成功后新
cookie 自动可见；持锁失败则重放再 401 走 auth-gate。

补充「锁被其他 tab 持有 → 跳过 doRefresh」用例，此前无法真正验证。
```

问题：
- body 是大段散文，不是 bullet points
- 「逻辑自欺欺人」是情绪词，不应出现在提交信息
- 旧方案为什么错、新方案为什么对，这些论证应该放在 PR 描述或 ADR

应改为：

```text
fix(web): 用 navigator.locks ifAvailable 实现跨 tab 互斥

- 移除 refreshedThisRound 模块级标志
- 改用 navigator.locks.request({ ifAvailable: true }) 保证同 origin 单 tab 执行 refresh
- 跳过 refresh 的 tab 直接重放原请求，依赖共享 cookie 获取新凭证
- 补充锁被占用时跳过 doRefresh 的测试用例
```

**反例二：把 body 写成设计讨论**

```text
refactor(api): 删除 TokenStore.Verify 死代码

refresh 改用原子 Rotate 后，Verify 已无调用者（grep 确认零引用）。
此前保留是出于「未来可能只读校验」的推测，属于 speculative generality——
YAGNI，删之。Rotate 的 Lua 内部已用字符串比对完成校验，无需独立 Verify。

涉及：TokenStore 接口、RedisTokenStore 实现、MockTokenStore 三处同步删除，
以及随之失效的 crypto/subtle import。CodeStore.Verify（验证码存储）不受影响。
编译期断言（auth_adapters.go）确保所有实现同步更新。
```

问题：
- 出现 YAGNI、speculative generality 等设计讨论用语
- 「此前保留是出于……」这种历史心路历程没必要写
- 仍然是散文，不是 bullet points

应改为：

```text
refactor(api): 删除 TokenStore.Verify 死代码

- refresh 改用原子 Rotate 后 Verify 已无调用者
- 同步删除 TokenStore 接口、RedisTokenStore、MockTokenStore 中的 Verify
- 移除 crypto/subtle 中失效的 import
- CodeStore.Verify 保持不变
```

## PR 与 issue 规范

### Issue 标题格式

用 **`[scope] 描述`**,不要 `vertical: ...`(vertical slice 是拆分方法论,不该暴露在标题)。对齐仓库已有的 `[code-runner] Tn` 系列惯例。

- ✅ 正确：`[musicctl] 别名 argv 重写 + 首发六枚内置`
- ✅ 正确：`[code-runner] T9 部署配置 + 文档同步`
- ❌ 错误：`vertical: 补全挂载(kit 表驱动...)`(暴露实现方法论,且冗长)

连续任务序列(如 code-runner T1–Tn)带 `Tn` 编号;独立 feature 不带编号。scope 用最内层模块名(同提交 scope 规则)。

### Issue labels

- **默认不加 label**。仅当改动性质明确匹配 GitHub 内置语义 label 时才加(如 `bug`、`documentation`)。
- **禁止加 `ready-for-agent`** 等流程性 triage label——本仓库不跑 AFK agent 拣选流程,此类 label 无信息量(triage 五角色仅用于外部来件的 triage 流转)。

### PR 创建

开 PR 时(`gh pr create`)固定配齐:

- **assignees**:`@me`(当前 gh 账号,即 `--assignee @me`)。
- **reviewers**:仓库全部 collaborator(艾特全部人)——`DefectingCat`、`xunrua`、`JingpengZhang`。用 `--reviewer DefectingCat,xunrua,JingpengZhang`。
- **labels**:**默认不加 label**。仅当改动性质明确匹配 GitHub 内置语义 label 时才加(如纯文档加 `documentation`、修 bug 加 `bug`)。**禁止加 `ready-for-agent`** 等流程性 label(对人工 review 无信息量)。
- **base**:指向 `release/2.0`(仓库主开发分支,非 `main`)。

### 合并

- **手动合并**,不勾 auto-merge。由人工 review approve 后在 UI 点合并。
- 合并方式:**squash merge**(单 commit 历史,与已有 PR 惯例一致)。
- 合并后:**自动删除分支**(`gh pr merge --squash --delete-branch`,合并即删远程+本地 feature 分支)。

