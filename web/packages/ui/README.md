# @violet/ui

React 19 组件库，使用原生 HTML 与 Radix 提供交互行为，用类型化 BEM 类名连接组件和 CSS。

## 当前范围

`component-manifest.json` 记录每个组件的入口、样式和成熟度。Button、Checkbox、Dropdown、ImagePixelReveal、Input、Label、LinkCard、SearchInput、Segmented、Textarea、UploadTile 是当前 11 个 `foundation` 单元；其余 34 个单元保留 API，并标为 `legacy`。兼容入口不代表已经重建所有组件。

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

`.dark` 类切换明暗取值，`prefers-contrast: more` 自动启用提高对比度的色阶。默认 violet（种子 `#684dda`）与 coral 由 `@violetjs/theme` 在构建时生成，可通过 `@violet/ui/palettes/violet.css` 或 `@violet/ui/palettes/coral.css` 取用。组件只使用语义 token；算法不进入组件运行时。库的字体默认使用系统字体；本站的字体和装饰动效由 `web/src/styles/site-theme.css` 提供。

## 使用

```tsx
import { Button, Input } from "@violet/ui";

export function ProfileForm() {
  return (
    <form>
      <Input label="昵称" name="nickname" clearable />
      <Button type="submit">保存</Button>
    </form>
  );
}
```

也可以从 `@violet/ui/button`、`@violet/ui/input` 等组件入口导入。`@violet/ui/variants` 只导出类名 recipe，不依赖 React；`@violet/ui/legacy` 提供存量兼容入口。

Input 的 `className`、`style`、原生属性、事件和 `ref` 属于 input；根布局通过 `classNames.root` 设置，视觉外壳通过 `classNames.control` 设置。可选 `label`、`description`、`errorMessage` 与 `invalid` 提供字段关联，不接管值或校验。`variant` 支持 outline / soft / ghost / underline，`controlSize` 支持 sm / md / lg，原生 `size` 仍是数字。`clearable` 产生真实输入事件，`passwordToggle` 仅用于密码输入；内部按钮共享控件焦点，不重播波纹。保留 FormData、reset、受控/非受控及 SSR ID 语义。[同源示例与 API](https://xunrua.top/ui/components/input)提供四变体、尺寸、错误、清除、密码和表单操作。

SearchInput 是独立单元，组合 Input 并复用其 `variant`、`controlSize`、字段信息和 `classNames`，只增加防抖、回车搜索、清除与加载反馈；基础 Input 不依赖搜索单元。`className` 仍属于真实 input，布局使用 `classNames.root`。仅需即时筛选时使用 `Input type="search"`。从 `@violet/ui` 或 `@violet/ui/search-input` 导入，按需样式为 `@violet/ui/components/search-input.css`，包含 Input CSS 依赖。[搜索契约](docs/components/search-input.md)与[同源示例](https://xunrua.top/ui/components/search-input)说明时序和样式归属。

Button 的 `asChild` 保留子元素内容，禁用或加载时阻止交互；自定义 Link 必须透传 DOM 属性和 ref。公开契约以组件类型与测试为准；`/ui/components/<name>` 提供可操作的示例与对应源码。

`default` 与 `primary` 按钮都遵循当前方言的 `primary` / `primary-foreground`，悬停使用 `primary-hover`；`soft` 采用 `selected` / `selected-foreground`，`link` 使用 `link`。组件不会绕过方言直接读取品牌色阶。

Checkbox 的 ref 指向可聚焦的 button；名称使用关联 Label 或 `aria-label`，表单字段由内部 input 桥接。三态、表单与纯 HTML 样式的边界见 [Checkbox 契约](docs/components/checkbox.md)。

ImagePixelReveal 让图片瓦片逐块裁剪展开，原图始终静止；默认 random 每轮重新洗牌，悬停可重播完整拼合，减弱动态时直接显示。`className` 约束根容器尺寸，`imgClassName` 调整默认图片；`children` 可替换内容，`src` 改变时重新开始独立周期。组件从 `@violet/ui` 导入，按需 CSS 为 `@violet/ui/components/image-pixel-reveal.css`；[可操作示例与 API](https://xunrua.top/ui/components/image-pixel-reveal)提供同源 TSX 和内嵌 SVG 资源。

UploadTile 是由父容器决定尺寸的方形原生按钮，默认加号，`busy` 显示加载指示并禁止激活，`disabled` 保留原生禁用行为。纯图标用法需提供 `aria-label`，ref、事件和表单属性直接落在 button；默认 `type="button"`。它不选择或上传文件，不依赖站点 API、会话或通知。从 `@violet/ui` 或 `@violet/ui/upload-tile` 导入；按需样式为 `@violet/ui/components/upload-tile.css`。[同源示例与 API](https://xunrua.top/ui/components/upload-tile)只记录按钮激活次数，独立 consumer 的 `?preview=upload-tile` 可操作忙碌、禁用、主题和窄屏状态。

LinkCard 是原生 anchor 的紧凑链接预览，接收 `href`、`title`、可选描述、站点名和图片，不依赖业务 DTO 或请求。左侧缩略图与卡片边缘相接，坏图退为文字卡，预览内容更新后可恢复；自动隐藏实质重复的标题/描述与站点/域名。ref、事件和导航策略属于整卡，默认安全新标签，调用方可覆盖。从 `@violet/ui` 或 `@violet/ui/link-card` 导入，按需 CSS 为 `@violet/ui/components/link-card.css`。[组件契约](docs/components/link-card.md)与[同源示例](https://xunrua.top/ui/components/link-card)说明原生行为，独立 consumer 的 `?preview=link-card` 覆盖图片降级、内容更新、主题和窄屏场景。

Dropdown 是指针悬停与键盘聚焦展开的披露面板，不是点击菜单：鼠标与笔停留展开，键盘聚焦（`:focus-visible`）立即展开，Escape 收起；点击触发器或面板从不切换开合，触屏不会展开，需要触屏可达时由宿主提供等价入口。`DropdownGroup` 让并列面板互斥并即时切换；`DropdownTrigger` 默认是 button，`asChild` 可把行为合并到链接并保留其点击与 `href`；`DropdownContent` 紧随触发器渲染并由 Radix Popper 定位，空间不足时自动翻向对侧。`DropdownItem` 默认原生按钮，`asChild` 可保留链接；同一面板共用一块跟随 hover 与键盘焦点的高亮，文字与图标不移动，减弱动态时直接切换。从 `@violet/ui` 或 `@violet/ui/dropdown` 导入；按需样式为 `@violet/ui/components/dropdown.css`。[同源示例与 API](https://xunrua.top/ui/components/dropdown)展示链接与按钮两种触发器的同组切换。

当前共享高亮的 `DropdownItem` 自动带 `data-highlighted`，宿主可据此同步图标或文字的强调样式；经过项间空隙与触发器间隙仍保留，切换目标、禁用或真正离开时更新。该状态表示 hover / 键盘焦点目标，不表示路由或业务选中。

Segmented 是带滑动指示器的分段控制：`orientation` 选横向或竖向，`variant` 选 `soft`、`ink`、`line`，`value` 受控，`segments` 描述各段。指示器位移走 transform，不缩放；设置 `itemSize` 进入不做 JS 测量的等尺寸布局，再加 `expandSelected` 让选中项占满剩余长度、其余收成只剩图标。方向键在启用项之间移动焦点，不改变选中值；`aria-label` 让容器带 `role="group"`，默认按钮分段带 `aria-pressed`，`render` 可把属性展开到链接或 Dropdown 触发器上。从 `@violet/ui` 或 `@violet/ui/segmented` 导入；按需样式为 `@violet/ui/components/segmented.css`。[同源示例与 API](https://xunrua.top/ui/components/segmented)覆盖方向与变体、等尺寸收起和链接分段，独立 consumer 的 `?preview=segmented` 可操作选中收起、主题和窄屏状态。

`OverlayScroll` 为受限高度的元素提供覆盖式滚动条，ref 与原生 div 属性仍指向滚动视口。整页使用 `<DocumentScrollbar />`，每个文档挂载一次，不包裹正文、不接管 `window` 滚动；弹层锁定文档滚动时滑块同步隐藏，卸载恢复原有滚动条。SSR 宿主可在 `<html data-scrollbar="none">` 上提前取消原生占位。两者从 `@violet/ui` 或 `@violet/ui/overlay-scroll` 导入；按需 CSS 为 `@violet/ui/components/overlay-scroll.css`，独立 consumer 的 `?preview=overlay-scroll` 可验证文档滚动、元素内横纵拖拽与卸载恢复。

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

`sync` 根据清单更新公开入口与样式列表，并根据种子与算法生成静态颜色；`check` 只读校验一致性。构建保留 ESM 模块并生成类型声明。`consumer` 将真实 tarball 安装到工作区外，检查类型、SSR、Vite 构建与入口模块可达性，并在禁用 JavaScript 的 Chromium 中验证纯 CSS 的明暗、提高对比度、命名主题、Button 悬停对比度与 Input 聚焦标签；工作区能运行不能替代这一步。

开发方法以包内 [架构指南](docs/architecture.md)与[组件设计流程](docs/component-design.md)为权威。`web/src/features/ui-docs/` 读取同一份正文，并提供安装、主题和组件 API 文档。

MIT License。
