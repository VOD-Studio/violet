# List

一行一条、要快速扫的内容：设置项、成员、文件、侧栏导航。行与行之间不画线，只隔 2px；悬停是一块在行间滑动的凹陷色（与下拉菜单同一种，由 `list-highlight` 提供）。要按列比较、排序、批量操作用 table；每条都要被单独看（带封面、摘要）用 card；有层级用 Tree；纯选值用 select 或 radio。拖拽排序不在这里，由 #728 单立。

```tsx
import {
  List, ListItem, ListItemAction, ListItemChevron, ListItemContent,
  ListItemDescription, ListItemIcon, ListItemTitle, ListItemValue,
} from "@violet/ui";

{/* 设置：整行可点，右边是当前值与箭头 */}
<List aria-label="设置">
  <ListItem onClick={() => navigate("/settings/language")}>
    <ListItemIcon><Languages /></ListItemIcon>
    <ListItemContent>
      <ListItemTitle>语言</ListItemTitle>
      <ListItemDescription>界面与日期格式</ListItemDescription>
    </ListItemContent>
    <ListItemValue>简体中文</ListItemValue>
    <ListItemChevron />
  </ListItem>
</List>

{/* 成员：行不可点，操作在右边 */}
<List aria-label="成员">
  <ListItem>
    <Avatar src={user.avatar} alt="" />
    <ListItemContent>
      <ListItemTitle>小径</ListItemTitle>
      <ListItemDescription mono>xiaojing@io.dev</ListItemDescription>
    </ListItemContent>
    <Tag>编辑</Tag>
    <ListItemAction aria-label="小径 的更多操作"><Ellipsis /></ListItemAction>
  </ListItem>
</List>

{/* 文件 */}
<ListItem>
  <ListItemIcon><FileImage /></ListItemIcon>
  <ListItemContent>
    <ListItemTitle mono>cover-season.webp</ListItemTitle>
    <ListItemDescription mono>1.2 MB · 11-02</ListItemDescription>
  </ListItemContent>
  <ListItemAction aria-label="下载 cover-season.webp"><Download /></ListItemAction>
</ListItem>

{/* 侧栏导航：紧凑，带当前项，行是调用方的路由链接 */}
<List aria-label="站点导航" density="compact">
  <ListItem asChild aria-current={active === "/blog" ? "page" : undefined}>
    <Link to="/blog">
      <ListItemIcon><BookOpen /></ListItemIcon>
      <ListItemContent><ListItemTitle>文章</ListItemTitle></ListItemContent>
      <ListItemValue mono>128</ListItemValue>
    </Link>
  </ListItem>
</List>
```

## API

复合组件；没有数据驱动的 `items`。

| 部件 | 元素 | 作用 |
| --- | --- | --- |
| `List` | `ul` | `density`：`"comfortable"`（行高 56，默认）或 `"compact"`（40）；`ref`、`className`、`aria-label` 等原生属性落在 `ul` 上 |
| `ListItem` | `li` > 行元素 | 一行；行元素的形态见下表。`ref`、`className`、原生属性与事件落在**行元素**上，不在 `li` 上 |
| `ListItemIcon` | `span` | 左侧 36 图标块（圆角 10，`--muted` 底，次级色图标）；紧凑下 28、无底色 |
| `ListItemContent` | `span` | 标题与说明的纵向容器，占满剩余宽度 |
| `ListItemTitle` | `span` | 14 / 500，单行省略；当前项 600。`mono`：等宽，13.5 |
| `ListItemDescription` | `span` | 13 次级色，单行省略。`mono`：等宽 |
| `ListItemValue` | `span` | 右侧次级色数值或当前设置。`mono`：等宽数字 |
| `ListItemChevron` | `svg` | 右侧 16 的箭头，`aria-hidden`；接受 lucide 图标的属性 |
| `ListItemAction` | `button` | 右侧 32 幽灵圆钮，`type` 默认 `button`；原生属性、`ref` 透传，可作 `DropdownMenuTrigger asChild` 的子元素 |

行元素的形态：

| 写法 | 行元素 | 类型约束 |
| --- | --- | --- |
| `<ListItem onClick={…}>` | `button`，`type="button"`；支持原生 `disabled` | `ref` 是 `Ref<HTMLButtonElement>` |
| `<ListItem asChild><a/Link/…></ListItem>` | 调用方的子元素，属性与 `ref` 合并到它上面，不多包一层 | `ref` 是 `Ref<HTMLElement>`，子元素必须透传属性与 `ref` |
| `<ListItem>` | `div`，没有任何交互角色 | `ref` 是 `Ref<HTMLDivElement>`；传 `disabled`、`type` 会被类型拒绝 |

行内容用 `span` 与 `svg`（不用 `div`），因此可以放进 button 与链接。头像直接放 `Avatar`，列表把它收成与图标块同样的 36（紧凑 28）；中性 `Tag` 在行被滑块罩住时换成纸色（`--v-tag-bg: var(--card)`），避免与滑块同色而消失。

## 调用方约定

- **整行可点的行里不要再放可交互元素**（组件不校验）：行是 button 或链接时，里面的 `ListItemAction` 会变成嵌套交互，读屏与键盘都不可靠。行里要有操作时，让行本身不可点（不传 `onClick`、不用 `asChild`），操作放右边。
- **每个 `ListItemAction` 的 `aria-label` 必须写清是谁的**：「小径 的更多操作」「下载 cover-season.webp」，不要都叫「更多」。列表里每行一个同样的名字，读屏用户无法区分。
- 头像放在已有名字的行里时给 `alt=""`（装饰），名字由标题朗读。
- `aria-current` 由调用方给：导航当前项写 `"page"`，其它场景可以写 `"true"`、`"location"` 等；`false` 或不写表示不是当前项。

## 当前项

当前项的底色（`--muted` 与悬停滑块同色）、墨色字、标题字重 600 按行元素上的 `aria-current` 取值（`false` 除外）显示，`ListItem` 的 `aria-current` 与 `asChild` 子元素自己写的 `aria-current` 都认。

当前项优先于悬停：当前项给 `list-highlight` 作静止位置，没有悬停时滑块停在它下面；悬停到别的行，滑块从当前项滑过去；移出列表或悬停到当前项自己，滑块回到（或留在）它下面，被行自己的同色底盖住，不会闪。需要这一静止位置时，`aria-current` 必须在 `ListItem` 的属性或 `asChild` 子元素的元素属性里写出；路由库在渲染内部自动补的 `aria-current`（比如 TanStack Link 对匹配路由自动加的）能让当前样式生效，但 React 层看不到，滑块不会停靠，此时悬停离开后滑块淡出而不是回到当前项。

## 键盘与读屏

| 操作 | 结果 |
| --- | --- |
| Tab / Shift+Tab | 依次经过整行可点的行与行内的操作按钮；纯展示行不在 Tab 顺序里 |
| Enter | 激活 button 行或链接行；激活操作按钮 |
| Space | 激活 button 行与操作按钮（链接按原生行为不响应） |

没有方向键移动：列表不是菜单，焦点跟着 Tab 走。组件不拦截 Enter 与 Space 的按下，交给原生激活。键盘焦点环是行内 2px 的 `--ring`（偏移 −2px，落在行里面，不被外层裁剪）。整行是 button 或链接时，键盘焦点让滑块跟过去，指针按下获得的焦点不触发滑块；焦点落在行内的 `ListItemAction` 上时只有按钮自己的焦点环，滑块不动。

读屏：`ul` / `li` 是列表与列表项，名称取 `List` 的 `aria-label`。整行是 button 或链接时名称取行内文字（标题加说明，右侧的值、箭头也会读出）；当前项读出 `aria-current` 的取值。`ListItemChevron` 与图标不读。

## 悬停、动效与减弱动态

悬停与键盘焦点用共用的 `ListHighlight`（`pointer` 模式）：滑块在行间滑动 280ms `cubic-bezier(.32,.72,0,1)`，第一次出现直接淡入 120ms；触屏指针不触发。减弱动态下滑块直接跳，不滑动（行为在 `list-highlight.css`，列表自己没有动画）。行上、操作按钮上都没有过渡。禁用的行（`disabled`，或 `asChild` 行上的 `aria-disabled="true"`）40% 透明、不接管滑块；asChild 行**不会**拦截点击，调用方要自己处理。

纯展示行与带操作的行同样参与悬停滑块（设计稿如此），不要因此误认为它们可点：光标是默认箭头，只有 button 与带 `href` 的链接行是手形。

## 设计稿取舍

- 标题也单行省略；设计稿只规定了说明省略，这里保证行高恒为 56 / 40。
- 设计稿用 36 的头像，`Avatar` 只有固定几档（24 / 32 / 40 …），列表里用 CSS 把它收成 36（紧凑 28），不扩 `AvatarSize`。
- 设计稿「等宽」用站点的 Maple Mono；包内用 `--font-mono`，站点按需覆盖。
- 不做虚拟滚动、排序、拖拽。

## 导入

React 从 `@violet/ui` 或 `@violet/ui/list` 导入；按需 CSS 使用 `@violet/ui/components/list.css`，已含 `list-highlight` 的样式；头像、标签的样式各自按需导入。
