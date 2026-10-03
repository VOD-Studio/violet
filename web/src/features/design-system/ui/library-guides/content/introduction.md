## 使用 Violet/UI

`@violet/ui` 提供 React 19 组件、公开类型、语义 token 与组件 CSS。组件库规范维护在 `web/packages/ui/docs/`；本页展示当前站点的接入方式，示例使用真实组件。

```tsx
import { Button, TextField } from "@violet/ui";

export function ProfileForm() {
  return (
    <form>
      <TextField label="显示名称" name="displayName" required />
      <Button type="submit">保存</Button>
    </form>
  );
}
```

## 先确认组件状态

当前 6 个重建单元是 Button、Checkbox、Input、Label、Textarea、TextField，清单中标记为 `foundation`。其余 36 个公开单元保留原 API 并标为 `legacy`；它们仍能被现有页面使用，行为与视觉需要逐个迁移。状态以 `web/packages/ui/component-manifest.json` 为准。

新单元以 native 或 Radix 承担行为，typed recipe 选择 BEM 类，组件 CSS 表达视觉。React 与纯 HTML 复用同一份基础样式。legacy 单元保留原 recipe 与兼容 CSS，尚未完成这一统一。

- [快速入门](/design-system/guides/quick-start)：在工作区或独立项目安装，导入样式。
- [组件库架构](/design-system/guides/architecture)：依赖方向、CSS 单一真相、清单与分发边界。
- [组件设计方法](/design-system/guides/component-design)：新增单元、登记入口、补行为与消费验证。
- [组件目录](/design-system/specimens)：真实用法、可操作示例与限制。

## 主题由宿主选择

组件使用语义 token。默认 Violet 色板可以替换，明暗切换由宿主管理 `.dark`，路由、请求和表单校验留在应用。Maple 字体、手写签名和博客装饰动画属于站点样式，不随通用组件强制加载。

React 项目通常在 Tailwind v4 后导入 `@violet/ui/styles.css`。纯 HTML 或不使用 Tailwind 的宿主可以导入 `tokens.css` 与 `classes.css`，或按组件选取 CSS；这些规则只提供外观，键盘与焦点行为仍由 native 元素或交互组件承担。

## 当前分发范围

包采用 MIT 协议，工作区以 `workspace:*` 消费源码；仓库外通过构建后的 tarball 安装。ESM、类型声明与 CSS 一起交付，根入口兼容现有调用，叶子入口可明确取用单个组件。组件 JS、纯 recipe 与 CSS 的依赖范围分别检查，完整 CSS 不会随 JS tree-shaking 自动裁剪。

npm 公开发布、专用安装 CLI 和组件文档 MCP 尚未交付。Figma 资产也不在当前范围。查看[重建进度](/design-system/guides/roadmap)后，再按[快速入门](/design-system/guides/quick-start)接入。
