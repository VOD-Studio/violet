# @violet/ui

在包内编辑组件、样式或公开导出前，读 `.agents/skills/violet-ui/SKILL.md` 与 `frontend-conventions`；改 Tailwind 类时还要读 `tailwind-canonical-classes`。

## 组件边界

- 所有组件放在 `src/components/<name>/`，实现、有变体时的 `styles.ts`、唯一组件 CSS、入口和测试就近维护。`legacy.ts` 只汇总兼容导出，不放第二份实现。
- `component-manifest.json` 是入口、CSS、文档与成熟度的清单。变更后执行 `sync`，再用只读 `check` 检查派生文件；不手工维护第二套导出列表。
- 成熟度以清单的 foundation / legacy 状态为准，不另维护组件列表。新架构组件只在 CSS 定义基础外观；有变体时的 `styles.ts` 只映射类型化 BEM 类名，无变体不建立空 recipe。旧组件迁移前仍有兼容样式，不宣称全库已经统一。
- 组件使用原生控件或 Radix 的真实能力。原生属性、ref、表单行为、键盘行为与事件取消语义必须完整保留；增加抽象要有实际需求和消费方，不预建空 provider、engine 或层级目录。
- `src/lib/` 只放真实复用。通用 token 与字体默认值在 `src/styles/`；站点字体、业务逻辑和装饰动效留在宿主。

## API 与消费

- 根入口与组件入口在工作区指向源码；pack 后由 `publishConfig` 指向 dist 的 ESM、声明与 CSS。`@violet/ui/variants` 保持不依赖 React，JS 按需加载与 CSS 按需加载分别验证。
- Tailwind v4 宿主在 Tailwind 之后导入 `@violet/ui/styles.css`。普通 CSS 宿主先导入 `tokens.css`，再导入 `classes.css` 或某个 `components/<name>.css`。
- TextField 的 `className`、style、ref 与原生属性属于 input；根布局用 `classNames.root`。描述和错误的 ID 只关联实际 DOM；错误只在 invalid 状态显示。
- Button 的 asChild 必须保留子 DOM，禁用与加载状态拦截子元素交互，自定义 Link 要透传 DOM 属性和 ref。事件组合尊重 `defaultPrevented`。

## 文档与验证

- 实现契约、原生键盘、受控与非受控值、FormData/reset、ref、SSR ID 等行为需要有针对性的测试。源码检查、构建检查与真实 tarball 消费分别执行。
- 运行 `pnpm --filter @violet/ui check`、`typecheck`、`test`、`build`、`check:dist`、`consumer`。`consumer` 在工作区外安装真实 tarball；不要把 workspace 成功视为发布形态已经正确。
- 规范正文在包内 `docs/`，旧站点仅为临时 integration 展示。现有示例在 `web/src/features/design-system/ui/`。预览与复制源码来自同一个 `ui/examples/<component>/*.tsx`；新增页面同步 route、catalog、lazy registry 与 `web/public/llms.txt`。目录或边界变化按 `docs/agents/docs-map.md` 同步 README、AGENTS 与 skill。
- 架构与设计流程以 `web/packages/ui/docs/architecture.md`、`component-design.md` 为权威，不从旧营造法式推导规范。作者 pass 与 verifier pass 分开，不在作者上下文自称批准。
- npm 发布、专用 CLI、MCP 均未完成，不在文档中作完成承诺。遵循仓库中文 Conventional Commit 与仅本地提交规则。
