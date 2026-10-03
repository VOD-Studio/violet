---
name: violet-ui
description: 在 violet 仓库使用、扩展 @violet/ui 或编写包内规范与 integration 示例时，核对组件清单、原生行为、样式入口、同源示例与真实 tarball 消费。
---

# 使用与扩展 @violet/ui

1. 先读 `web/packages/ui/component-manifest.json`，按 status 区分 foundation 与 legacy，不另维护组件列表；兼容导出不代表已经重建。所有实现统一放在 `src/components/<name>/`，`legacy.ts` 只有导出汇总。
2. 编辑前端代码前读 `frontend-conventions`；改 className 前读 `tailwind-canonical-classes`。先读 `web/packages/ui/docs/architecture.md` 与 `component-design.md`，从需求、原生语义与可验证契约确定设计；旧营造法式不作为规范依据。站点业务组件留在 feature，跨 feature 的通用组件才进入库。
3. 从具体消费场景确定组件的 HTML 语义、属性归属、状态、键盘行为和组合方式。使用原生控件或 Radix；文件在组件目录就近维护。`lib` 只提取真实复用，不预建没有消费方的 provider、polymorphic engine 或空目录。
4. foundation 有变体时的 `styles.ts` 只映射类型化 BEM 类名，无变体不建立空 recipe；基础外观只有一份组件 CSS，React 与 HTML 共用。Tailwind utility 用于布局和局部覆盖。旧组件迁移前保留兼容样式，避免把两套外观误称为已经统一。包使用系统字体默认值，站点字体和装饰动效留在 `web/src/styles/site-theme.css`。
5. 保留 native 属性、ref、受控与非受控值、FormData/reset、SSR ID 和事件取消语义。TextField 的 className/style/ref 属于 input，根布局用 `classNames.root`；描述和错误只关联实际 DOM。Button asChild 保留子内容，禁用或忙碌时拦截子 handlers，自定义 Link 必须透传 props 和 ref。
6. 增加或迁移组件时登记清单，再运行 `pnpm --filter @violet/ui sync` 与只读 `check`。清单驱动根入口、组件入口、legacy 汇总、包 exports 与 CSS 列表；不要维护第二套列表。`@violet/ui/variants` 保持纯 recipe，不依赖 React。
7. 常规 React 消费从 `@violet/ui` 或组件入口导入，Tailwind v4 之后加载 `@violet/ui/styles.css`。普通 CSS 消费先加载 `tokens.css`，再加载 `classes.css` 或 `components/<name>.css`。JS 与 CSS 的按需加载分别核对。工作区入口指向源码，pack 后由 publishConfig 指向 dist。
8. 在 `web/src/features/design-system/ui/examples/<component>/` 写真实 TSX 示例，文档同时 import 组件预览与 `.tsx?raw`。新增页面同步 route、catalog、lazy registry、llms.txt，并按 docs-map 同步负责的 README/AGENTS。页面明确成熟度；旧案例不能作为新架构已完成的证据。
9. 执行包的 `check`、`typecheck`、`test`、`build`、`check:dist`、`consumer`。最后一步把真实 tarball 安装到工作区外，验证类型、SSR、Vite 构建与模块可达性。补充明暗、窄屏、键盘与 reduced motion 预览，再交给独立 verifier；作者 pass 不自称批准。

架构指南在 `web/packages/ui/docs/architecture.md`，逐步流程在同目录 `component-design.md`，包边界见 `web/packages/ui/AGENTS.md`。

包尚未发布 npm；外部安装先 build/pack，再用实际 tarball 文件名。没有专用组件 CLI 或 MCP；智能体可读取 `/llms.txt`、组件源码和此 skill。遵循仓库中文本地 commit 与不推送规则。
