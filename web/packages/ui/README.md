# @violet/ui

React 19 组件库，使用原生 HTML 与 Radix 提供交互行为，用类型化 BEM 类名连接组件和 CSS。

## 当前范围

`component-manifest.json` 记录每个组件的入口、样式和成熟度。Button、Checkbox、Input、Label、Textarea、TextField 是当前 6 个 `foundation` 单元；其余 36 个单元保留 API，并标为 `legacy`。兼容入口不代表已经重建所有组件。

所有组件都放在 `src/components/<name>/`，实现、有变体时的 `styles.ts`、CSS、入口和测试就近维护。`src/legacy.ts` 只汇总兼容导出；`src/lib/` 只放有实际消费方的复用能力。

## 安装

仓库内通过 `workspace:*` 消费源码。仓库外需要 React 19 和 react-dom 19；本包尚未发布 npm，从 violet 仓库的 `web` 目录构建并打包：

```bash
pnpm --filter @violet/ui build
pnpm --filter @violet/ui pack --pack-destination /tmp
# 在目标项目安装实际生成的文件；文件名中的版本来自 package.json
pnpm add /tmp/violet-ui-0.1.0.tgz
```

## 样式

Tailwind CSS v4 宿主在全局 CSS 中导入完整入口：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

基础组件的 React 与 HTML 共用同一份 BEM CSS。布局和局部覆盖可以使用 Tailwind utility；组件基础外观由自己的 CSS 维护。完整入口仍包含 legacy 所需的兼容样式。

不使用 Tailwind 的宿主可以导入预编译 CSS：

```css
@import "@violet/ui/tokens.css";
@import "@violet/ui/classes.css";
```

按需只加载 Button 时，第二行换成 `@import "@violet/ui/components/button.css";`。组件 CSS 需要先加载 tokens；JavaScript 的按需加载与 CSS 的按需加载分别由宿主选择入口。

`.dark` 类切换明暗取值。主色预设可用 `@violet/ui/palettes/violet.css` 或 `@violet/ui/palettes/coral.css`；主题按语义 token 覆盖；包内规范独立于旧站点。库的字体默认使用系统字体；本站的 Maple、签名字体和装饰动效由 `web/src/styles/site-theme.css` 提供。

## 使用

```tsx
import { Button, TextField } from "@violet/ui";

export function ProfileForm() {
  return (
    <form>
      <TextField label="昵称" name="nickname" description="公开展示的名字" />
      <Button type="submit">保存</Button>
    </form>
  );
}
```

也可以从 `@violet/ui/button`、`@violet/ui/text-field` 等组件入口导入。`@violet/ui/variants` 只导出类名 recipe，不依赖 React；`@violet/ui/legacy` 提供存量兼容入口。

TextField 的 `className`、原生属性和 `ref` 属于 input；根布局通过 `classNames.root` 设置。Button 的 `asChild` 保留子元素内容，禁用或加载时阻止交互；自定义 Link 必须透传 DOM 属性和 ref。公开契约以组件类型与测试为准；旧站点保留可操作的 integration 示例。

Checkbox 的 ref 指向可聚焦的 button；名称使用关联 Label 或 `aria-label`，表单字段由内部 input 桥接。三态、表单与纯 HTML 样式的边界见 [Checkbox 契约](docs/components/checkbox.md)。

## 开发与验证

在仓库 `web` 目录执行：

```bash
pnpm --filter @violet/ui sync
pnpm --filter @violet/ui check
pnpm --filter @violet/ui typecheck
pnpm --filter @violet/ui test
pnpm --filter @violet/ui build
pnpm --filter @violet/ui check:dist
pnpm --filter @violet/ui consumer
```

`sync` 根据清单更新公开入口和样式列表；`check` 只检查一致性。构建保留 ESM 模块并生成类型声明。`consumer` 将真实 tarball 安装到工作区外，检查类型、SSR、Vite 构建及根入口和组件入口的模块可达性；工作区能运行不能替代这一步。

开发方法以包内 [架构指南](docs/architecture.md)与[组件设计流程](docs/component-design.md)为权威。旧营造法式仅 raw import 同一份正文，不能用旧站点案例决定新库规范。

MIT License。
