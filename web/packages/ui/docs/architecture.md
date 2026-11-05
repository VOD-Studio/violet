## 从哪一层改起

Violet/UI 的包名是 `@violet/ui`。React 组件、CSS 和类型声明在同一个包里交付；本目录维护组件库的架构与设计规范。

先看 `web/packages/ui/component-manifest.json`。`foundation` 表示已按新结构实现；`legacy` 表示保留兼容入口、尚未重建。当前 28 个基础单元是 Avatar、Badge、Button、Card、Checkbox、ContextMenu、Dropdown、DropdownMenu、HoverCard、ImagePixelReveal、Indicator、Input、Kbd、Label、LinkCard、Popover、Radio、SearchInput、Segmented、Separator、Skeleton、Sonner、Switch、Tabs、Textarea、ToggleGroup、Tooltip、UploadTile。其余 22 个单元，包括 Dialog，仍属于 legacy；旧页面能运行不代表已经完成新架构改造。

```text
web/packages/ui/
  component-manifest.json
  src/
    components/
      button/
        button.tsx
        button.css
        styles.ts
        index.ts
        __tests__/
      input/
      ...
    styles/
      palettes/*.generated.css
      fixed.generated.css
      tokens.css
      foundation.css
      theme.css
    lib/
    index.ts
    legacy.ts
    variants.ts
    styles.css
    tokens.css
    classes.css
  docs/
  scripts/
  tests/
  fixtures/consumer/
```

| 要改的内容 | 所属位置 | 使用约束 |
| --- | --- | --- |
| 原生语义、事件、ref、组件结构 | `web/packages/ui/src/components/<name>/` | 全部组件共用这一层目录；基础控件保留 HTML 行为，复杂交互使用 Radix |
| variant / size 到类名的映射 | 有变体的组件使用 `styles.ts` | 类型从 recipe 推导，输出稳定 BEM 类名；无变体不建立空 recipe |
| 组件外观与状态反馈 | 组件单元的 CSS | React 和纯 HTML 共用这份规则 |
| 生成色阶、语义 token 和 Tailwind 映射 | `web/packages/ui/src/styles/` | `@violetjs/theme` 只用于构建；组件只消费语义，不引用色阶 |
| 字体、博客方言和站点装饰动画 | `web/src/styles/` | 宿主负责加载字体和装饰资源 |
| 公开单元、状态、CSS、文档路径 | `component-manifest.json` | 派生入口通过同步命令生成 |
| 组件陈列（展品） | `web/src/features/ui-showcase/` | `/ui` 按占地陈列真实组件，不复制规格正文 |

组件单元的依赖方向如下。结构、按需 recipe、CSS、导出与测试放在同一目录，修改一个组件时能看到它的完整契约。`src/legacy.ts` 只是兼容 barrel，不保存另一份组件实现。`lib/` 只接收已经被多个组件使用的能力。

新增功能只有遇到真实消费场景才加入，不预建通用表单引擎、全局 provider、多态 engine、注册器或空的 system/primitives 层。

```text
宿主页面 ──> @violet/ui 根入口或组件叶子入口
                      │
                      ├── 组件结构 ──> native / Radix
                      └── styles.ts ──> BEM 类名

React 输出的 BEM 类 ──┐
纯 HTML 使用的 BEM 类 ─┴──> 同一份组件 CSS ──> 语义 token ──> 生成色阶

component-manifest.json ──> 根入口 / legacy / exports / 构建与 CSS 清单
```

## CSS 只维护一份

以前 React recipe 和 `classes.css` 各自描述按钮外观，改一边容易漏掉另一边。新单元让 recipe 只负责选择类名，视觉写入组件 CSS。`@violet/ui/classes.css` 汇集这些规则，叶子 CSS 入口提供同一个组件的规则。legacy 单元保留原有 recipe 与兼容样式，目录搬迁不会自动消除其双轨视觉实现。

完整接入保留 Tailwind v4 的工具类和主题映射：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

只用基础按钮外观时，可以按 CSS 入口取用；这一层不需要 React，也不要求扫描包源码：

```css
@import "@violet/ui/tokens.css";
@import "@violet/ui/components/button.css";
```

```html
<button type="button" class="v-button v-button--primary">保存</button>
```

工具类可以在 utilities layer 调整布局或覆盖外观。主题调整优先覆盖语义变量，保留焦点与错误提示。JS tree-shaking 和 CSS 取用是两件事：导入完整 `classes.css` 不会因为只用了 Button 就自动删除其他 CSS。

颜色生成入口是 `scripts/theme.mjs`：violet 与 coral 同时生成浅色、深色及提高对比度四种组合，默认使用 violet 种子。固定中性动作与沉浸灰阶也由同一算法生成。`tokens.css` 仅维护用途映射，本站三方言只改映射、不重写色值；状态色在方言间继承一致。`edge-hairline` 与 `surface-glass` 使用透明度色阶，图表与分类组件共享分类色。

Button 的主要动作变体统一消费 `primary`、`primary-hover` 和 `primary-foreground`；`text-primary` 在 Tailwind 的文字命名空间里映射到 `primary-text` 可读档，状态色与分类色同理，实色档不直接当文字色。悬停档与前景由算法成对求解，不使用降低对比度的透明混色。链接、选择、进度与装饰有独立语义，工具方言无需靠主要动作变量表达所有品牌反馈。

`@violet/ui/variants` 只导出类名 recipes，不导入 React 组件。新增样式 recipe 时需要检查该入口的依赖图，不能让一次类名计算拉入 Dialog、图表或动效运行时。

## 组件先承诺行为，再选择外观

新单元对外保留标准 DOM 属性和 ref。Button 默认 `type="button"`；表单提交要显式设置 `type="submit"`。加载状态阻止重复交互并暴露 `aria-busy`，常规反馈通过颜色、描边和透明度表达。纯图标按钮由调用方提供 `aria-label`。

`Button asChild` 把属性与样式交给唯一子元素。导航仍用链接；禁用或忙碌时，组件同时拦截子元素的交互 handler。自定义路由链接必须透传属性和 ref。此模式保留子元素内容，不插入 `leftIcon`、`rightIcon` 或 `loadingText`。

`asChild` 同时划定类型边界。原生模式保留 `HTMLButtonElement` 的 ref、事件与表单属性；`asChild={true}` 使用 `HTMLElement` 的通用属性、ref 和事件，可接收链接的 object/callback ref。`href`、`target` 等子元素专属属性放在子元素上；需要访问链接专属属性的事件也放在链接上。React 19 的 callback ref cleanup 继续参与 Slot 的引用合并与卸载清理。

Input 可选地组合名称、说明和错误信息。它不接管值、校验规则或请求状态：

```tsx
import { Input } from "@violet/ui";

<Input
  label="邮箱"
  name="email"
  type="email"
  autoComplete="email"
  required
/>
```

`className`、`style`、事件与 ref 继续属于 input；外层通过 `classNames.root` 调整布局，视觉外壳使用 `classNames.control`。未传 `id` 时使用 `useId` 生成 SSR 稳定的关联标识。`aria-describedby` 合并并去重宿主 ID 和实际存在的说明、错误节点；错误只在 invalid 时显示。`variant` 与 `controlSize` 由 typed recipe 推导，原生 `size` 仍为数字。清除与密码显隐按钮属于同一个复合焦点范围，不因焦点在内部转移而重播聚焦反馈；hover 仅在该范围没有焦点时生效。

SearchInput 是独立的 `search-input` 组合单元，依赖 `input`，不反向把搜索状态或样式塞入基础单元。它复用 Input 的变体、尺寸、字段信息和样式槽，仅增加防抖、回车搜索、清除时序与加载反馈；查询请求仍由调用方管理。搜索单元的叶子 CSS 引入 Input CSS，基础 Input 的叶子入口不包含搜索行为或样式。只有图标或即时本地筛选时，使用 `Input type="search"`，不引入 SearchInput 的调度。

| 输入场景 | 外观选择 |
| --- | --- |
| 独立表单、账号、配置及确认字段 | 默认 outline，保留明确字段边界 |
| 列表工具栏筛选、聊天搜索 | soft；紧凑工具栏使用 controlSize="sm" |
| 已有容器边界的弹层搜索、大标题编辑、页码 | ghost，避免重复描边 |
| 用户资料或表格中的行内改名 | underline，编辑线与展示内容衔接 |

外观不决定状态所有权：即时过滤仍可用 Input，防抖搜索使用 SearchInput。文件选择、range、checkbox、OTP 及行为 primitive 自己管理的输入，不套文本 Input 的外壳。

状态有明确归属：原生属性表达 disabled、required 和 invalid；Button 的 `data-loading` 表达加载；Radix 控件沿用其 `data-state`。`data-slot` 标识结构部件。组件不得为每次 hover 创建全局状态，也不得用 CSS 外观冒充键盘行为。

ImagePixelReveal 的 `className` 属于根容器，用于约束尺寸；`imgClassName` 属于默认图片，`children` 可替换默认内容。单一 BEM CSS 驱动 SVG 遮罩中的瓦片裁剪展开，原图和自定义内容保持静止，不复制图片背景或切换图像合成层。默认 random 每轮重新洗牌；单格 320ms，延迟跨度 380ms，悬停重播同样的瓦片拼合。根节点以 `data-state="loading|revealing|revealed"` 表达生命周期，`src` 改变开始独立周期；减弱动态直接显示，播放中开启该偏好也会完成当前周期。

展示类单元（`badge`、`avatar`、`kbd`、`card`、`separator`、`skeleton`）的状态由调用方持有，组件只承诺读屏契约。胶囊 `Count` 与 `Dot` 对读屏隐藏，数量或「有新动态」必须写进宿主的可访问名称；`Count` 为 0 时不渲染，超过 `max` 显示 `99+`。`Avatar` 的 `alt` 默认取 `name`，`alt=""` 表示名字已在旁边显示的装饰用法，在线状态与作者标记写进可访问名称；图片未到时只有底色呼吸，失败退回首字，换 `src` 重新加载。`AvatarGroup` 压叠排列，指针悬停时展开（设计稿没有设计，沿用站点既有行为），展开只在 `(hover: hover)` 下生效，减弱动态下直接切换。`Kbd` 未传 `platform` 时，服务端与水合首帧按非 macOS 输出，水合后再切换为符号，避免水合差异。`CardFrameTitle asChild` 的链接用伪元素把点击区扩到整张卡，卡内其他按钮层级更高，仍可单独点击。`Skeleton` 默认 `aria-hidden`，忙碌状态由所在区域的 `aria-busy` 表达，只用凹陷色做透明度起伏，不加扫光。

选择类单元（`switch`、`radio`、`toggle-group`、`tabs`、`segmented`）共用一套键盘契约：整组只占一个 Tab 停靠位，方向键在启用项之间移动，跳过禁用项。Switch 与 ToggleGroup 的每项是原生 button（Space/Enter 激活）；RadioGroup 用原生 radio 的方向键换选；Tabs 沿用 Radix 的自动激活。Segmented 默认项是 `role="radio"` 的 button、容器 `role="radiogroup"`，带 `render` 的导航类分段保持普通 group 语义。加载中的 Switch 挂 `aria-busy` 并忽略激活，视觉仍跟随宿主的 `checked`；失败回退由宿主翻转状态完成，圆钮自动滑回。Tabs 的底线指示器与渐隐层对读屏隐藏，测量在客户端完成，SSR 不输出位置。

浮层类单元（`popover`、`hover-card`、`tooltip`、`dropdown`、`dropdown-menu`、`context-menu`、`sonner`）共用一套出场：从触发器一侧浮出并淡入，收起往触发器方向退并淡出，不缩放。时长与位移按各自的组件稿：弹出层 200/140ms、6/4px，悬停卡片 200/120ms、4px，文字提示 150/120ms，下拉面板 220/140ms，操作菜单 200/140ms，右键菜单 180/120ms 且收起原地淡出，子菜单 180/140ms。共用关键帧在 `src/styles/float.css`，内容元素带 `.v-float`，选择器零优先级，单元用 `--v-float-*` 变量覆盖；减弱动态下只剩 100ms 透明度。挂到 body 的内容层级是 `--layer-float`（60，盖过 50 的对话框与侧边面板），原位渲染的下拉是 `--layer-dropdown`（40），文字提示 `--layer-tooltip`（70），轻提示 `--layer-toast`（90）。需要 Portal 的内容都接受 `container`，陈列室据此把浮层收进展品舞台，随检视台的明暗、季节与减弱动态变化。

Popover 非模态：无遮罩，背后可滚动；点外面、Esc、再点触发器关闭，焦点回到触发器，点到别的可聚焦元素时尊重那次聚焦；触发器滚出视野时自动关闭。面板 `role="dialog"`，默认用触发器命名，传 `aria-label` 时以它为准。触发器是 Button 时，打开期间的按下态由 `aria-expanded` 驱动。HoverCard 悬停 500ms 出现、离开 200ms 消失，指针从触发词移到卡片上不消失，键盘聚焦同样延迟出现，Esc 立即消失，触屏不出现；卡片只做预览，不放按钮。Tooltip 的 `TooltipProvider` 默认 0 延迟，指针离开 60ms 后才退回，按下触发器、Esc 与失焦立即收起；相邻触发器之间同一个气泡滑过去（180ms），所以相邻触发器要在同一个 Provider 下；`truncatedOnly` 只在文字确实被截断时出现；气泡不接收指针，不放链接和按钮。

DropdownMenu 与 ContextMenu 共用一套项：键盘打开焦点进第一项，指针打开不预先高亮；↑↓ 循环、Home/End 到两端；不可用项带 `aria-disabled`、被键盘跳过，原因写在右侧（`reason`）；多选项默认点了不收起（`closeOnSelect` 可覆盖），单选项与普通项执行后收起。子菜单悬停 100ms 打开，离开触发项后有 120ms 宽限，← 与 Esc 只收起子菜单、焦点回到触发项，只用一层。汉字标签的前缀预测按拼音声母匹配（取 GB2312 一级字表，生僻字与繁体字按原字匹配，多音字取表中读音），英文标签按字面前缀。Toaster 以 sonner 为引擎，调用方继续 `import { toast } from "sonner"`：成功与信息 4 秒、警告 6 秒、带操作 8 秒，出错与加载中不自动关，调用方传 `duration` 时以它为准；每个通知区最多保留 6 条；加载中的图标用指示器单元的控件圆弧，卡片本身就是「正在……」的证据，圆弧不再叠加 200ms 延迟。稿里的这些点没有实现：同一条消息合并为 ×N；卡片 `role="alert"` 与 `role="status"` 之分；加载中通知的关闭钮；退场受 sonner 200ms 卸载所限；抽屉打开时把通知区抬到抽屉上方——前四点来自 sonner 本身，末点需要跨特性协调，均待后续工单。

## Violet 的设计规则

这些规则针对现有库的维护问题，是否有效要由具体组件和消费验证证明。组件设计从真实消费场景、需求和 DOM 契约推导。

| 规则 | 解决的问题 | 验证方式与边界 |
| --- | --- | --- |
| 原生语义优先 | 封装后丢失 ref、表单提交或键盘行为 | Input 的 className/ref 属于 input，保留受控与非受控、FormData/reset；关联 ID 在 SSR 水合后保持一致。复合浮层使用 Radix 的真实能力 |
| 单视觉源 | React 与 HTML 外观各维护一套，改一次漂移一次 | foundation 的 BEM CSS 同时供两种消费；recipe 只选类名，utility 在宿主做局部覆盖。legacy 尚未全部迁移 |
| 组合样式依赖闭合 | 按需加载后字段标签或说明缺少样式 | Input 的叶子 CSS 包含字段外层、视觉控件、标签与信息规则；宿主先导入 tokens，不猜测内部依赖 |
| 清单追踪成熟度 | 一个新组件让整库看起来已经重建 | 清单区分 foundation 与 legacy，派生入口保持兼容；成熟度升级要有行为、视觉、文档与消费证据 |
| 源码与安装包分开验证 | 工作区源码能跑，打包后却缺文件、类型或样式 | 真实 tarball 安装到工作区外，再检查类型、SSR、Vite 和入口模块可达性；不能用构建目录存在代替消费者成功 |

用户直接提出的约束继续生效：常规交互不用 scale 或方向性滑入滑出，功能圆角不超过 16px，浮起只用 `0 4px 24px / 0.05` 软影。通用主题保持系统字体与可覆盖的语义 token，宿主的品牌预设不成为基础控件依赖。

能力由实际需求推动：Button 与 Input 需要变体，所以有 `styles.ts`；Label 等无变体单元直接使用稳定类名。出现多个真实复用方后再提取 lib，避免让架构承担尚不存在的状态和场景。

## 清单如何防止入口漂移

组件清单的每一项登记 `name`、`status`、`entry`，按需要提供 `css` 与 `documentation`；`documentation` 只指向包内 `docs/components/` 的契约正文。例如新增组件时：

```json
{
  "name": "checkbox",
  "status": "foundation",
  "entry": "src/components/checkbox/index.ts",
  "css": "src/components/checkbox/checkbox.css",
  "documentation": "web/packages/ui/docs/components/checkbox.md"
}
```

在 `web` 目录运行 `pnpm --filter @violet/ui sync` 后检查 diff；`check` 以只读方式检查清单派生入口及生成颜色 CSS。生成物缺失、手工修改或算法与种子变化但未同步时均失败。不要在根 barrel、legacy barrel、package exports 和 CSS 清单中各登记一遍同一个组件。组件迁移时替换该项并改变状态，避免新旧实现同时进入根入口。

工作区入口指向源码；打包形态由 `publishConfig` 指向 dist 的 ESM 与声明文件。两种消费方式必须分别验收。具体命令和组件新增流程见[组件设计方法](./component-design.md)。

## 把验证分到真实边界

源码检查回答依赖方向、清单、类型和行为是否一致；独立消费者回答装包后能否使用。两边不能互相替代。

| 边界 | 需要拿到的证据 |
| --- | --- |
| native 控件 | 键盘激活、disabled、受控与非受控值、原生事件、object/callback ref |
| 字段组合 | 可访问名称、说明/错误关联、唯一 ID、FormData、reset、SSR hydration |
| CSS | 明暗主题、窄屏、焦点与错误视觉、减弱动态；HTML 与 React 的 BEM 一致 |
| dist 与 tarball | 独立安装后类型检查、SSR、Vite 构建、根/叶子入口和 variants 的依赖图 |

升级 legacy 单元时先补行为契约，再替换实现与清单状态。第一阶段没有重写全部组件，也没有发布 npm、安装 CLI 或组件文档 MCP；具体成熟度以组件清单为准。
