# @violet/ui

React 19 组件库，使用原生 HTML 与 Radix 提供交互行为，用类型化 BEM 类名连接组件和 CSS。

## 当前范围

`component-manifest.json` 记录每个组件的入口、样式和成熟度。Avatar、Badge、Button、Card、Checkbox、CommandList、ConfirmDialog、ContextMenu、Dialog、Drawer、Dropdown、DropdownMenu、HoverCard、ImagePixelReveal、Indicator、Input、Kbd、Label、LinkCard、ListHighlight、MorphingPopover、Popover、PromptDialog、Radio、SearchInput、Segmented、Separator、Sheet、Skeleton、Sonner、Switch、Tabs、Textarea、ToggleGroup、Tooltip、UploadTile 是当前 36 个 `foundation` 单元；其余 16 个单元保留 API，并标为 `legacy`。兼容入口不代表已经重建所有组件。

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

Input 的 `className`、`style`、原生属性、事件和 `ref` 属于 input；根布局通过 `classNames.root` 设置，视觉外壳通过 `classNames.control` 设置。可选 `label`、`description`、`errorMessage` 与 `invalid` 提供字段关联，不接管值或校验。`variant` 支持 outline / soft / ghost / underline，`controlSize` 支持 sm / md / lg，原生 `size` 仍是数字。`clearable` 产生真实输入事件，`passwordToggle` 仅用于密码输入；内部按钮共享控件焦点，不重播波纹。保留 FormData、reset、受控/非受控及 SSR ID 语义。[陈列室展品](https://xunrua.top/ui?open=input)可逐态查看四种外观的默认、错误、禁用与只读。

SearchInput 是独立单元，组合 Input 并复用其 `variant`、`controlSize`、字段信息和 `classNames`，只增加防抖、回车搜索、清除与加载反馈；基础 Input 不依赖搜索单元。`className` 仍属于真实 input，布局使用 `classNames.root`。仅需即时筛选时使用 `Input type="search"`。从 `@violet/ui` 或 `@violet/ui/search-input` 导入，按需样式为 `@violet/ui/components/search-input.css`，包含 Input CSS 依赖。[搜索契约](docs/components/search-input.md)说明时序和样式归属，[陈列室展品](https://xunrua.top/ui?open=search-input)可查看搜索中与禁用态。

Button 的 `asChild` 保留子元素内容，禁用或加载时阻止交互；自定义 Link 必须透传 DOM 属性和 ref。公开契约以组件类型与测试为准；[陈列室展品](https://xunrua.top/ui?open=button)陈列各变体与尺寸的默认、加载与禁用态。

`default` 与 `primary` 按钮都遵循当前方言的 `primary` / `primary-foreground`，悬停使用 `primary-hover`；`soft` 采用 `selected` / `selected-foreground`，`link` 使用 `link`。组件不会绕过方言直接读取品牌色阶。

Checkbox 的 ref 指向可聚焦的 button；名称使用关联 Label 或 `aria-label`，表单字段由内部 input 桥接。三态、表单与纯 HTML 样式的边界见 [Checkbox 契约](docs/components/checkbox.md)。

ImagePixelReveal 让图片瓦片逐块裁剪展开，原图始终静止；默认 random 每轮重新洗牌，悬停可重播完整拼合，减弱动态时直接显示。`className` 约束根容器尺寸，`imgClassName` 调整默认图片；`children` 可替换内容，`src` 改变时重新开始独立周期。组件从 `@violet/ui` 导入，按需 CSS 为 `@violet/ui/components/image-pixel-reveal.css`；[陈列室展品](https://xunrua.top/ui?open=image-pixel-reveal)可切换四种揭示顺序并悬停重播。

UploadTile 是由父容器决定尺寸的方形原生按钮，默认加号，`busy` 显示加载指示并禁止激活，`disabled` 保留原生禁用行为。纯图标用法需提供 `aria-label`，ref、事件和表单属性直接落在 button；默认 `type="button"`。它不选择或上传文件，不依赖站点 API、会话或通知。从 `@violet/ui` 或 `@violet/ui/upload-tile` 导入；按需样式为 `@violet/ui/components/upload-tile.css`。[陈列室展品](https://xunrua.top/ui?open=upload-tile)陈列默认、忙碌与禁用，独立 consumer 的 `?preview=upload-tile` 可操作忙碌、禁用、主题和窄屏状态。

LinkCard 是原生 anchor 的紧凑链接预览，接收 `href`、`title`、可选描述、站点名和图片，不依赖业务 DTO 或请求。左侧缩略图与卡片边缘相接，坏图退为文字卡，预览内容更新后可恢复；自动隐藏实质重复的标题/描述与站点/域名。ref、事件和导航策略属于整卡，默认安全新标签，调用方可覆盖。从 `@violet/ui` 或 `@violet/ui/link-card` 导入，按需 CSS 为 `@violet/ui/components/link-card.css`。[组件契约](docs/components/link-card.md)说明原生行为，[陈列室展品](https://xunrua.top/ui?open=link-card)可切换封面、Logo、无图与坏图，独立 consumer 的 `?preview=link-card` 覆盖图片降级、内容更新、主题和窄屏场景。

Dropdown 是指针悬停与键盘聚焦展开的披露面板，不是点击菜单：鼠标与笔停留展开，键盘聚焦（`:focus-visible`）立即展开，Escape 收起；点击触发器或面板从不切换开合，触屏不会展开，需要触屏可达时由宿主提供等价入口。`DropdownGroup` 让并列面板互斥并即时切换；`DropdownTrigger` 默认是 button，`asChild` 可把行为合并到链接并保留其点击与 `href`；`DropdownContent` 紧随触发器渲染并由 Radix Popper 定位，空间不足时自动翻向对侧。`DropdownItem` 默认原生按钮，`asChild` 可保留链接；同一面板共用一块跟随 hover 与键盘焦点的高亮，文字与图标不移动，减弱动态时直接切换。从 `@violet/ui` 或 `@violet/ui/dropdown` 导入；按需样式为 `@violet/ui/components/dropdown.css`。[陈列室展品](https://xunrua.top/ui?open=dropdown)展示链接与按钮两种触发器的同组切换和向上展开。

当前共享高亮的 `DropdownItem` 自动带 `data-highlighted`，宿主可据此同步图标或文字的强调样式；经过项间空隙与触发器间隙仍保留，切换目标、禁用或真正离开时更新。该状态表示 hover / 键盘焦点目标，不表示路由或业务选中。

Dropdown、DropdownMenu、ContextMenu、命令面板、Select 候选与自定义动作列表共享高亮实现：280ms、`cubic-bezier(0.32, 0.72, 0, 1)`，文字和图标不移动，首次进入直接落位，减弱动态直接切换。条目通过底色表示悬停与焦点，不再叠加边框；输入框和独立触发按钮的聚焦环不受影响。Select 仍为 legacy，此处只补齐候选项的高亮，不代表完成组件重建。

自定义列表从 `@violet/ui` 导入 `ListHighlight` 和 `ListHighlightItem`。两者都把属性与 ref 合并到唯一子元素，不增加 DOM 包裹；点击、选值、焦点与键盘导航仍由宿主管理：

```tsx
import { ListHighlight, ListHighlightItem } from "@violet/ui";

export function Actions() {
  return (
    <ListHighlight>
      <ul>
        <li><ListHighlightItem><button type="button">复制链接</button></ListHighlightItem></li>
        <li><ListHighlightItem><button type="button">存为图片</button></ListHighlightItem></li>
      </ul>
    </ListHighlight>
  );
}
```

`mode="pointer"`（默认）跟随悬停与可见键盘焦点，指针离开后退回带 `active` 的条目；`mode="focus"` 跟随真实焦点，用于 Radix 菜单与选择器，不绕过其子菜单宽限；`mode="active"` 只读取条目的 `active`，适合焦点留在输入框的命令列表。原生属性与 ref 必须由自定义子组件继续透传。

从 `@violet/ui/list-highlight` 也可按需导入；叶子 CSS 是 `@violet/ui/components/list-highlight.css`，完整样式入口已包含它。容器 `::before` 留给底色，条目保持透明背景，不额外添加当前行背景。禁用项不高亮，嵌套列表各自管理，尺寸变化重新测量；内部 Hook 不公开，不要求消费方维护选择器或观察器。

Segmented 是带滑动指示器的分段控制：`orientation` 选横向或竖向，`variant` 选 `soft`、`ink`、`line`，`value` 受控，`segments` 描述各段。纸片滑动 280ms，不缩放；设置 `itemSize` 进入不做 JS 测量的等尺寸布局，再加 `expandSelected` 让选中项占满剩余长度、其余收成只剩图标。方向键在启用项之间移动并同时选中；容器为 `role="radiogroup"`，默认按钮分段带 `aria-checked`，`render` 可把属性展开到链接或 Dropdown 触发器上并保持普通 group 语义。从 `@violet/ui` 或 `@violet/ui/segmented` 导入；按需样式为 `@violet/ui/components/segmented.css`。[陈列室展品](https://xunrua.top/ui?open=segmented)陈列三种变体与图标分段，独立 consumer 的 `?preview=segmented` 可操作选中收起、主题和窄屏状态。

`OverlayScroll` 为受限高度的元素提供覆盖式滚动条，ref 与原生 div 属性仍指向滚动视口。整页使用 `<DocumentScrollbar />`，每个文档挂载一次，不包裹正文、不接管 `window` 滚动；弹层锁定文档滚动时滑块同步隐藏，卸载恢复原有滚动条。SSR 宿主可在 `<html data-scrollbar="none">` 上提前取消原生占位。两者从 `@violet/ui` 或 `@violet/ui/overlay-scroll` 导入；按需 CSS 为 `@violet/ui/components/overlay-scroll.css`，独立 consumer 的 `?preview=overlay-scroll` 可验证文档滚动、元素内横纵拖拽与卸载恢复。

`badge` 单元包含 `Tag`、`TagToggle`、`Badge`、`Count`、`Dot` 与 `BadgeAnchor`：Tag 给内容分类，TagToggle 是带 `aria-pressed` 的筛选标签，Badge 以 `tone` 表示记录状态且文字本身就是信息，Count 与 Dot 提示未读。胶囊 Count 与 Dot 对读屏隐藏，数量要写进宿主的可访问名称；为 0 时 Count 不渲染，超过 `max` 显示 `99+`。`avatar` 单元的 Avatar 在图片未到时呼吸占位、失败退回首字，`alt` 默认取 `name`，`alt=""` 表示装饰，在线状态与作者标记写进可访问名称；AvatarGroup 超出 `max` 折成「+N」，指针悬停时展开压叠，触屏不展开，减弱动态下直接切换。Kbd 渲染原生 `<kbd>`，一个组合键一个键帽，未传 `platform` 时水合后才按访客系统切换符号。`card` 单元保留 `Card*` 复合结构并新增相框卡 `CardFrame*`，只有 `CardFrameTitle asChild` 的链接承载点击并扩到整张卡；Separator 装饰用法为 `role="none"`，区块之间传 `decorative={false}` 得到 `<hr>`；Skeleton 默认 `aria-hidden`，只用凹陷色起伏，不加扫光。以上单元均从 `@violet/ui` 或同名叶子入口导入，按需 CSS 为 `@violet/ui/components/<name>.css`，[陈列室展品](https://xunrua.top/ui?open=badge)可逐态查看，独立 consumer 的 `?preview=display` 覆盖头像加载失败、计数、标签、键帽平台与相框卡点击。

分隔线的圆点、带字与区块形态可在[独立展品](https://xunrua.top/ui?open=separator)中并排查看；卡片与骨架留在[卡片展品](https://xunrua.top/ui?open=card)。

`switch`、`radio`、`toggle-group`、`tabs` 四个控件单元沿用同一套键盘与读屏契约。Switch 是 `role="switch"` 的原生按钮，`loading` 期间圆钮显示梅花指示器并忽略激活，`aria-busy` 立即生效；尺寸 sm/md/lg 三档。RadioGroup/Radio 用原生 `<input type="radio">` 放进 `fieldset`，`legend` 视觉隐藏但命名整组，一组一个 Tab 位，方向键换选并同时选中；`appearance="card"` 提供选项卡片。ToggleGroup 的每一项都是原生 button 加 `aria-pressed`（单选也不用 radio），整组一个 Tab 位，方向键只移焦点不改按下态，单选再点归零、多选各自开关；`variant="bare"` 是工具栏形，`ToggleGroupSeparator` 分隔组段。Tabs 保留 Radix 语义（←→ 移动即切换、Home/End 到首尾、面板可聚焦），当前项下方一条墨色 2px 底线滑动 280ms 到新位置，`TabsCount` 的计数是标签名称的一部分，放不下时横向滚动且当前项自动滚入可见区；竖排为个人主页侧栏保留，设计稿没有该形态。Segmented 默认项改为 `role="radiogroup"`/`role="radio"` 语义、纸片滑动 280ms；带 `render` 的导航类分段仍是普通 group。以上单元均从 `@violet/ui` 或同名叶子入口导入，按需 CSS 为 `@violet/ui/components/<name>.css`，[陈列室](https://xunrua.top/ui?open=switch)可逐态操作。

`morphing-popover` 单元的 `MorphingPopover`、`MorphingPopoverTrigger`、`MorphingPopoverContent` 让一个有底色的胶囊或圆钮自己长成面板：外形从按钮的位置、大小与圆角长出，内容晚一拍浮现，收起时缩回；同一个根里换一块 `key` 不同的面板即接力，新面板从旧面板长出，关闭直接缩回最初的按钮。`ghost` 放触发器上字的副本，`outset` 让面板的角比按钮外扩，`radius` 是展开后的圆角；Esc、点外面、焦点离开都会收起，开启减弱动态时只做 100ms 淡入淡出。从 `@violet/ui` 或 `@violet/ui/morphing-popover` 导入，按需 CSS 为 `@violet/ui/components/morphing-popover.css`；[陈列室展品](https://xunrua.top/ui?open=morphing-popover)可操作灵动岛展开卡与回应选择器的接力。

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

开发方法以包内 [架构指南](docs/architecture.md)与[组件设计流程](docs/component-design.md)为权威。站点的 `/ui` 陈列室按占地陈列各单元的真实组件，不复制规格正文。

MIT License。
