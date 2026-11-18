---
name: violet-ui
description: 在 Violet 使用或扩展 @violet/ui 时，核对组件清单、原生语义、样式入口，并通过独立 tarball 消费和实际业务页面验收。
---

# 使用与扩展 @violet/ui

1. 先读 `web/packages/ui/component-manifest.json`，按 status 区分 foundation 与 legacy，不另维护组件列表；兼容导出不代表已经重建。所有实现统一放在 `src/components/<name>/`，`legacy.ts` 只有导出汇总。
2. 编辑前端代码前读 `frontend-conventions`；改 className 前读 `tailwind-canonical-classes`。先读 `web/packages/ui/docs/architecture.md` 与 `component-design.md`，从需求、原生语义与可验证契约确定设计。站点业务组件留在 feature，跨 feature 的通用组件才进入库。
3. 从具体消费场景确定组件的 HTML 语义、属性归属、状态、键盘行为和组合方式。使用原生控件或 Radix；文件在组件目录就近维护。`lib` 只提取真实复用，不预建没有消费方的 provider、polymorphic engine 或空目录。
4. foundation 有变体时的 `styles.ts` 只映射类型化 BEM 类名，无变体不建立空 recipe；基础外观只有一份组件 CSS，React 与 HTML 共用。Tailwind utility 用于布局和局部覆盖。旧组件迁移前保留兼容样式，避免把两套外观误称为已经统一。包使用系统字体默认值，站点字体和装饰动效留在 `web/src/styles/site-theme.css`。
5. 保留 native 属性、ref、受控与非受控值、FormData/reset、SSR ID 和事件取消语义。Input 的 className/style/ref 属于 input，外壳是根元素，用 `classNames.control`；标签、描述、错误属于表单项，输入框只原样透传 `aria-describedby` 与 `aria-invalid`。Button asChild 保留子内容，禁用或忙碌时拦截子 handlers，自定义 Link 必须透传 props 和 ref。
6. 增加或迁移组件时登记清单，再运行 `pnpm --filter @violet/ui sync` 与只读 `check`。清单驱动根入口、组件入口、legacy 汇总、包 exports 与 CSS 列表；不要维护第二套列表。`@violet/ui/variants` 保持纯 recipe，不依赖 React。
7. 常规 React 消费从 `@violet/ui` 或组件入口导入，Tailwind v4 之后加载 `@violet/ui/styles.css`。普通 CSS 消费先加载 `tokens.css`，再加载 `classes.css` 或 `components/<name>.css`。JS 与 CSS 的按需加载分别核对。工作区入口指向源码，pack 后由 publishConfig 指向 dist。
8. 按[组件设计方法](../../../web/packages/ui/docs/component-design.md#跑源码检查与真实消费者)执行包内检查、行为测试、构建和 `consumer`。`consumer` 在工作区外安装真实 tarball，验证类型、SSR、Vite 构建与按需 CSS；不能用工作区导入成功替代。
9. 打开实际使用该组件的业务页面，走一次受影响的操作，核对明暗主题、窄屏、键盘焦点与减弱动态。弹层还要检查展开和关闭后的焦点。按[文档责任地图](../../../docs/agents/docs-map.md)同步对应文档，分别记录包内、独立消费者与页面的验证结果，交由独立 reviewer 复核。

架构指南在 `web/packages/ui/docs/architecture.md`，逐步流程在同目录 `component-design.md`，包边界见 `web/packages/ui/AGENTS.md`。

包尚未发布 npm；外部安装先 build/pack，再用实际 tarball 文件名。没有专用组件 CLI 或 MCP；智能体可读取 `/llms.txt`、包内 `docs/`、组件源码和此 skill。遵循仓库中文本地 commit 与不推送规则。
