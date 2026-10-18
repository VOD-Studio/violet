# @violetjs/kanban 维护指南

消费者从 [中文 README](./README.zh-CN.md)、[English README](./README.md) 和 [API 文档](./docs/api.md) 开始。本文描述仓库维护和交付验收，不是发布授权。

## 环境与边界

使用仓库规定的 pnpm，开发工具为 TypeScript、Vitest、esbuild、Playwright；运行时 peer 为 React 19，react-dom 仅用于开发和外部消费验收。Node 版本应满足仓库和所装工具的要求；不要因本机能运行就声明所有 Node 版本受支持。构建脚本是 JavaScript，不依赖直接执行 TypeScript。

- `src/core/`：React-free 状态、移动、规则、命令历史、关系、布局和视口函数。
- `src/board/`：受控看板、键盘与指针控制、列切换、编辑及关系呈现。
- `src/canvas/`、`src/graph/`、`src/responsive/`、`src/history/`：相应组件与 hooks。
- `src/index.ts`：带样式根入口；`src/unstyled.ts`：不带 CSS 的同一组件 API。
- `src/styles.css`：默认样式总入口，构建时保留各样式文件。
- `examples/`：四个独立可消费的 README 示例；不依赖站点别名或业务模块。
- `scripts/`：构建、README 同步和外部 tarball 消费验收；不进入发布包。
- 同目录测试、`src/test/` 与 `browser/`：开发验收，不进入发布包。

源码内部使用直接相对导入，保留 `.ts`/`.tsx` 扩展名，由构建重写到 `.js`。不得增加站点私有依赖，不把 CSS 引入 unstyled/core/canvas/graph 入口图，不把 React 引入 core。公开入口由 package.json 和各 index/unstyled 清单共同定义；修改类型或行为时同步 API 文档和相应测试。

## 维护命令

以下命令从仓库根目录运行，按顺序执行；没有隐式发布：

```sh
make kanban-examples
make kanban-check
make kanban-test
make kanban-build
make kanban-browser
make kanban-consumer
```

| 命令 | 实际职责 |
| --- | --- |
| `make kanban-examples` | 同步四份完整 TSX 到双语 README，不截图、不启动浏览器 |
| `make kanban-check` | 先只读检查示例同步，再 `tsc --noEmit`，包括 examples |
| `make kanban-test` | 包内 Vitest 行为测试 |
| `make kanban-build` | 构建 ESM、声明并复制样式 |
| `make kanban-browser` | 使用已安装 Playwright Chromium 运行浏览器交互测试 |
| `make kanban-consumer` | 打包、在工作区外安装真实 tarball，检查类型/SSR/生产构建与依赖边界 |
| `make kanban-pack NPM_PACK_DEST=/absolute/output/directory` | 向指定目录写 tarball；prepack 先检查示例再构建 |

包目录也可执行 `pnpm examples`、`pnpm examples:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm browser`、`pnpm consumer`。`pnpm examples:check` 只核对，不改写 README；漂移、缺失或重复 marker 都应失败。仓库 Biome 检查另按根维护约定运行，不把类型检查称为 lint。

浏览器安装属于显式环境准备：在包目录执行 `pnpm exec playwright install chromium`。不要由验收脚本静默安装或切换用户浏览器。依赖安装需要 registry 可达或缓存齐全；网络失败不是包行为失败，也不能当成通过。

## README 示例同源规则

唯一代码源为：

| 文件 | 导出 |
| --- | --- |
| `examples/quick-start.tsx` | QuickStart |
| `examples/editable.tsx` | EditableBoard |
| `examples/canvas.tsx` | CanvasBoard |
| `examples/graph.tsx` | Graph |

`scripts/sync-readme.mjs` 将完整文件复制到两份 README 的 `<!-- example:NAME:start -->` / `<!-- example:NAME:end -->` 之间，代码围栏为 tsx。每个 NAME 在每份 README 中恰好一对 marker。先改 TSX，再运行同步；不要只修 README 里的代码。示例不生成图片，也没有图片像素溯源清单。

editable 示例只演示本地移动和命令历史，不虚构服务器成功。canvas 示例在 ResponsiveLayout 之外持有顺序、选中项与活动列，避免跨分支重挂载丢状态。graph 示例同时提供 RelationList 文字等价。任何新增业务 API 都不应混进这些独立示例。

## 工作区外真实 tarball 验收

`pnpm consumer` 先核对双语示例再执行 `pnpm pack`，后者触发 `prepack = pnpm examples:check && pnpm build`。临时目录由系统 tmpdir 创建，独立项目安装实际 tgz，不使用 workspace 链接或源码路径替换。

验收覆盖：

1. tarball 白名单、MIT、双语 README、API/维护文档、四个完整示例、全部 JS/声明/CSS；禁止 src、测试、source map 混入。
2. 已打包 main/types/全部 exports 均指向存在的 dist 文件，package.json 入口可消费，根声明为 unstyled.d.ts，不要求消费者补 ambient CSS 声明。
3. 所有入口解析到临时项目安装产物，不逃逸到工作区；没有隐藏运行时依赖，peer 只有 React。
4. 公开类型与 tarball 中复制出来的四个示例在 Bundler 和 NodeNext 两种解析模式下检查，skipLibCheck 为 false。
5. 纯函数与无样式组件的 Node SSR；四例 SSR 还核对卡片/列顺序、只读无移动入口、编辑与历史初态、ResponsiveLayout 的 SSR wide 分支、两条关系的实际文字等价。
6. 四例经 esbuild 生成浏览器生产产物，四个可见分区保留根入口样式；输入依赖图限制在独立安装目录，不含站点别名。示例 SSR 构建明确将 CSS 视为空载入，真实浏览器产物则保留 CSS，不能混为一个检查。
7. 根入口 named import 在生产摇树后保留默认 CSS；显式 styles.css 与 package.json 入口可构建；unstyled/core/canvas/graph 不加载 CSS，core 不加载 React。

默认结束后删除临时目录。需要排查或浏览实际发布包示例时，在包目录执行：

```sh
pnpm consumer --keep
```

也可从仓库根执行 `pnpm --dir web --filter @violetjs/kanban consumer --keep`。日志返回实际临时根和浏览器预览目录，结构为 `<临时根>/consumer/preview/index.html`；该目录包含 preview.js 和 preview.css。使用已有静态 HTTP 服务打开 preview 目录，不要直接依赖 file URL。脚本不自动启动服务，也不把“产物已构建”报告为“浏览器交互已通过”。使用完后仅清理本轮保留的临时目录与自己启动的服务。

## 浏览器与人工检查

Playwright 测试覆盖拖动、窄屏切换、画布、关系与图等交互。触屏事件为仿真；390px 视口、ARIA/DOM 断言、动画耗时采样都不能替代真机或真实读屏。

行为或样式变化时，应在最终宿主页面检查：Tab 焦点与外圈、键盘拿起/放下/取消、单指针菜单替代、筛选禁移、失败保存保稿、自动排序规则、触屏长按/滚动冲突、画布缩放/全屏/退出、窄宽切换保留受控状态、关系文字与导航、减弱动态和亮暗主题。真实读屏应检查名称、顺序、live 播报和 inert 区域；未执行就明确写未执行。

此包没有虚拟化或统一的设备性能保证。不要把某个数据集的计时写成所有消费者都能达到的上限，也不要把浏览器性能阈值测试称为真实设备认证。

## 发布前检查清单

当前任务不发布 npm、不改版本、不打 tag、不加入发布工作流。未来每次发布均须单独取得授权，并完成：

- [ ] 确认版本、变更范围、MIT 归属、`@violetjs` scope 权限和发布身份；有版本号不等于已经发布。
- [ ] 确认双语 README、API、维护说明与公开入口一致，四例同步检查无漂移；文档和示例本体都在 tarball 内，未合并分支也能离线阅读相对链接。
- [ ] 按顺序完成类型、测试、构建、浏览器和真实 tarball 验收，并记录实际结果、环境失败与尚未执行的人工项。
- [ ] 检查打包产物只有允许文件，所有 exports/main/types 指向 dist；根 JS 与 CSS 的 sideEffects 保留。使用 pnpm 的 publishConfig 重写，不换用忽略重写的打包工具。
- [ ] 确认 root 自动 CSS 不被摇树移除，CSS-free 入口保持无样式，core 保持 React-free；无站点路径、工作区依赖或安装后脚本。
- [ ] 核对 homepage/repository/bugs 的公开地址在目标集成分支上有效；包内相对链接不应依赖尚未合入的远程页面。
- [ ] 对本次修改相关行为完成目标浏览器、真机与辅助技术检查，或如实列出未验收项；不能以仿真结果代替。
- [ ] 按仓库独立 npm 包发布流程另行决定版本、工作流接入与 dry-run，取得发布授权后才执行实际发布；发布后另查 registry 元数据与真实安装结果。

任何现有维护脚本都不应自行推送、发布、修改版本或创建 release。发包状态须有 registry 证据，不能从构建成功、tarball 文件或 Git 分支状态推断。
