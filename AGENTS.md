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
- **数据库代码生成**: 修改 SQL 查询后，**必须**运行 `make sqlc`。
- **依赖注入生成**: 修改 DDD 的依赖注入项后，**必须**运行 `make wire`。
- **测试**: `make api-test`
- **代码检查**: `make api-lint` (使用 golangci-lint)

### 前端 (`web/`) 须知
- **代码检查与格式化**: 使用 **Biome** (非 ESLint/Prettier)。命令: `make web-lint` 和 `make web-format`。
- **类型检查**: `make web-typecheck`
- **测试**: `make web-test`
- **Tailwind CSS v4**: 支持任意数字值简写 (例如 `max-w-50` = 200px 替代 `max-w-[200px]`)。详见 `tailwind-arbitrary-values` skill。

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->

## 提交流程规范

- 每次完成一个任务或一个功能点都要进行 Git 提交。
- 提交信息必须使用**中文**，并严格符合历史的 Conventional Commits 格式，例如 `feat(api): 添加新功能`、`fix(web): 修复页面 bug`。
- **请勿推送**，仅在本地进行 commit。

### 提交原子性

一个 commit 只做一件完整的事。完整是指：这个 commit 可以被单独 revert、单独 cherry-pick、单独 review，而不会让代码处于中间态或同时影响多个无关模块。

拆分原则按优先级从高到低执行：

1. **独立组件单独提交**
   `shared/ui` 中的通用组件，或被多个 feature 引用的实体、接口、hooks、utils，新增、重构、修 bug 都要单独提交。

   ✅ 正确：
   - `feat(web): 封装封面图选择器 Cover 组件`
   - `fix(web): Cover 组件空值时回显异常`

   ❌ 错误：
   - `feat(web): 文章编辑页接入 Cover 并修复空值回显`

   原因：接入页面和修复组件是两件事。混在一起回滚时会把页面改动一起带走。

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
