## 从哪一层改起

Violet/UI 的包名是 `@violet/ui`。React 组件、CSS 和类型声明在同一个包里交付；本目录维护组件库的架构与设计规范。

先看 `web/packages/ui/component-manifest.json`。`foundation` 表示已按新结构实现；`legacy` 表示保留兼容入口、尚未重建。当前 8 个基础单元是 Button、Checkbox、ImagePixelReveal、Input、Label、Textarea、TextField、UploadTile。其余 36 个单元，包括 Dialog、Tabs，仍属于 legacy；旧页面能运行不代表已经完成新架构改造。

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
      text-field/
      ...
    styles/
      palettes/
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
| 语义 token、色板和 Tailwind 映射 | `web/packages/ui/src/styles/` | 组件消费 token 名，色值可替换 |
| 字体、博客方言和站点装饰动画 | `web/src/styles/` | 宿主负责加载字体和装饰资源 |
| 公开单元、状态、CSS、文档路径 | `component-manifest.json` | 派生入口通过同步命令生成 |
| 组件库文档与示例 | `web/src/features/ui-docs/` | 架构与设计规范读取包内正文，预览与复制代码使用同一 TSX 文件 |

组件单元的依赖方向如下。结构、按需 recipe、CSS、导出与测试放在同一目录，修改一个组件时能看到它的完整契约。`src/legacy.ts` 只是兼容 barrel，不保存另一份组件实现。`lib/` 只接收已经被多个组件使用的能力。

新增功能只有遇到真实消费场景才加入，不预建通用表单引擎、全局 provider、多态 engine、注册器或空的 system/primitives 层。

```text
宿主页面 ──> @violet/ui 根入口或组件叶子入口
                      │
                      ├── 组件结构 ──> native / Radix
                      └── styles.ts ──> BEM 类名

React 输出的 BEM 类 ──┐
纯 HTML 使用的 BEM 类 ─┴──> 同一份组件 CSS ──> 语义 token ──> 色板

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

`@violet/ui/variants` 只导出类名 recipes，不导入 React 组件。新增样式 recipe 时需要检查该入口的依赖图，不能让一次类名计算拉入 Dialog、图表或动效运行时。

## 组件先承诺行为，再选择外观

新单元对外保留标准 DOM 属性和 ref。Button 默认 `type="button"`；表单提交要显式设置 `type="submit"`。加载状态阻止重复交互并暴露 `aria-busy`，常规反馈通过颜色、描边和透明度表达。纯图标按钮由调用方提供 `aria-label`。

`Button asChild` 把属性与样式交给唯一子元素。导航仍用链接；禁用或忙碌时，组件同时拦截子元素的交互 handler。自定义路由链接必须透传属性和 ref。此模式保留子元素内容，不插入 `leftIcon`、`rightIcon` 或 `loadingText`。

`asChild` 同时划定类型边界。原生模式保留 `HTMLButtonElement` 的 ref、事件与表单属性；`asChild={true}` 使用 `HTMLElement` 的通用属性、ref 和事件，可接收链接的 object/callback ref。`href`、`target` 等子元素专属属性放在子元素上；需要访问链接专属属性的事件也放在链接上。React 19 的 callback ref cleanup 继续参与 Slot 的引用合并与卸载清理。

TextField 将 Input 与 Label 组合成有名称的字段。它不接管值、校验规则或请求状态：

```tsx
import { TextField } from "@violet/ui";

<TextField
  label="邮箱"
  name="email"
  type="email"
  autoComplete="email"
  description="用于接收回复通知"
  required
/>
```

`className`、`style`、事件与 ref 继续属于 input；外层通过 `classNames.root` 调整布局。未传 `id` 时使用 `useId` 生成 SSR 稳定的关联标识。`aria-describedby` 合并宿主 ID 和实际存在的说明、错误节点；错误只在 invalid 时显示，内部 ID 只引用存在的节点；宿主提供的 aria-describedby ID 保留其语义，不因与内部 ID 重名而删除。

状态有明确归属：原生属性表达 disabled、required 和 invalid；Button 的 `data-loading` 表达加载；Radix 控件沿用其 `data-state`。`data-slot` 标识结构部件。组件不得为每次 hover 创建全局状态，也不得用 CSS 外观冒充键盘行为。

ImagePixelReveal 的 `className` 属于根容器，用于约束尺寸；`imgClassName` 属于默认图片，`children` 可替换默认内容。单一 BEM CSS 驱动 SVG 遮罩中的瓦片裁剪展开，原图和自定义内容保持静止，不复制图片背景或切换图像合成层。默认 random 每轮重新洗牌；单格 320ms，延迟跨度 380ms，悬停重播同样的瓦片拼合。根节点以 `data-state="loading|revealing|revealed"` 表达生命周期，`src` 改变开始独立周期；减弱动态直接显示，播放中开启该偏好也会完成当前周期。

## Violet 的设计规则

这些规则针对现有库的维护问题，是否有效要由具体组件和消费验证证明。组件设计从真实消费场景、需求和 DOM 契约推导。

| 规则 | 解决的问题 | 验证方式与边界 |
| --- | --- | --- |
| 原生语义优先 | 封装后丢失 ref、表单提交或键盘行为 | Input 保留原生属性；TextField 的 className/ref 属于 input，关联 ID 可在 SSR 水合后保持一致。复合浮层使用 Radix 的真实能力 |
| 单视觉源 | React 与 HTML 外观各维护一套，改一次漂移一次 | foundation 的 BEM CSS 同时供两种消费；recipe 只选类名，utility 在宿主做局部覆盖。legacy 尚未全部迁移 |
| 组合样式依赖闭合 | 只引入 TextField 样式却缺 Input/Label 外观 | TextField 的 CSS 引入它真实依赖的 Input 与 Label CSS；宿主先导入 tokens，之后组件 CSS 自带内部依赖 |
| 清单追踪成熟度 | 一个新组件让整库看起来已经重建 | 清单区分 foundation 与 legacy，派生入口保持兼容；成熟度升级要有行为、视觉、文档与消费证据 |
| 源码与安装包分开验证 | 工作区源码能跑，打包后却缺文件、类型或样式 | 真实 tarball 安装到工作区外，再检查类型、SSR、Vite 和入口模块可达性；不能用构建目录存在代替消费者成功 |

用户直接提出的约束继续生效：常规交互不用 scale 或方向性滑入滑出，功能圆角不超过 16px，浮起只用 `0 4px 24px / 0.05` 软影。通用主题保持系统字体与可覆盖的语义 token，宿主的品牌预设不成为基础控件依赖。

能力由实际需求推动：Button 需要变体，所以有 `styles.ts`；Input 与 TextField 只有固定基础结构时直接使用稳定类名。出现多个真实复用方后再提取 lib，避免让首期架构承担尚不存在的状态和场景。

## 清单如何防止入口漂移

组件清单的每一项登记 `name`、`status`、`entry`，按需要提供 `css` 与 `documentation`。例如新增组件时：

```json
{
  "name": "text-field",
  "status": "foundation",
  "entry": "src/components/text-field/index.ts",
  "css": "src/components/text-field/text-field.css",
  "documentation": "web/src/features/ui-docs/ui/TextFieldDoc.tsx"
}
```

在 `web` 目录运行 `pnpm --filter @violet/ui sync` 后检查 diff；`check` 以只读方式检查清单与派生入口。不要在根 barrel、legacy barrel、package exports 和 CSS 清单中各登记一遍同一个组件。组件迁移时替换该项并改变状态，避免新旧实现同时进入根入口。

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
