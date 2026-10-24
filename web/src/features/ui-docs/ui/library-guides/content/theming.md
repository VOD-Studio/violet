组件使用语义变量表达用色；主题提供色阶，方言决定每个用途取哪一档。组件结构与分发边界见[组件库架构](/ui/guides/architecture)。

## 三层颜色接口

1. **生成色阶**：`@violetjs/theme` 根据种子色生成品牌、中性、状态和分类色阶。品牌与中性另有透明度色阶。静态产物位于包内 `src/styles/palettes/*.generated.css`。
2. **语义映射**：`src/styles/tokens.css` 只声明用途到色阶的映射。本站的三种方言位于 `web/src/styles/dialects/`，不随组件包发布。
3. **Tailwind 映射**：`theme.css` 用 `@theme inline` 注册语义工具类，在使用元素的作用域读取变量。色阶本身不注册为工具类。

默认主题沿用 violet 种子 `#684dda`，另提供 coral。`scripts/theme.mjs` 是包内种子和生成选项的维护入口：

```bash
# 在仓库 web 目录运行
pnpm --filter @violet/ui sync
pnpm --filter @violet/ui check
```

`sync` 同时更新组件清单派生入口和颜色 CSS；`check` 只读比较生成结果，过期或缺失时失败。构建不会默默覆盖手工改过的产物。算法只作为构建依赖，不进入组件运行时。

## 接入样式

Tailwind v4 宿主先导入 Tailwind，再导入完整包样式：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
```

不使用 React、Tailwind 或客户端 JavaScript 时，可以直接加载纯 CSS：

```css
@import "@violet/ui/tokens.css";
@import "@violet/ui/components/button.css";
```

```html
<button type="button" class="v-button v-button--primary">保存</button>
```

`classes.css` 汇集全部组件规则；叶子 CSS 只包含对应组件及它的样式依赖。JavaScript tree-shaking 与 CSS 取用是两件事。

## 外观与提高对比度

`:root` 声明 `color-scheme: light`，`.dark` 声明 `color-scheme: dark`。生成值以 `light-dark()` 合并浅色和深色，给 `html` 加或移除 `dark` 即可切换外观。

每个主题同时生成标准与提高两档对比度；`@media (prefers-contrast: more)` 覆盖同名色阶。正文、次要文字、链接、控件边界和焦点随之提高对比度，不需要客户端监听媒体查询。

SSR 宿主必须在首屏输出与持久化外观一致的类。使用 next-themes 时，设置 `attribute="class"` 与 `enableColorScheme={false}`，不要用内联 `color-scheme` 覆盖类规则。包级 `useTheme` 也可管理 light / dark / system 与 localStorage；详细用法见[深色模式](/ui/guides/dark-mode)。

## 用途与方言

| 用途 | 语义变量 | 映射 |
| --- | --- | --- |
| 页面与正文 | `background` / `foreground` | 中性背景档 / 正文档 |
| 表面与文字 | `card` / `card-foreground` | 中性表面档 / 正文档 |
| 主要动作 | `primary` / `primary-foreground` | public 取品牌实色；tool 取固定高对比中性实色 |
| 主要动作悬停 | `primary-hover` | 与主要动作相同色阶的第 10 档 |
| 链接 | `link` / `link-hover` | 品牌可读文字档 |
| 选中与悬停 | `selected` / `selected-hover` / `selected-foreground` | 品牌浅底与可读文字 |
| 焦点与进度 | `ring` / `progress` | 品牌焦点档 / 实色档 |
| 装饰 | `decoration` / `decoration-hover` / `decoration-muted` / `decoration-foreground` | 品牌实色 / 配对悬停档 / 浅底 / 实色前景 |
| 危险、警告、成功 | `destructive` / `warning` / `success` | 固定状态实色；`-foreground` 为实色前景，`-text` 为页面上的可读状态文字 |
| 分类 | `category-1` 至 `category-6` | 固定分类实色；`-muted` 为浅底、`-text` 为可读文字、`-foreground` 为实色前景 |
| 图表 | `chart-1` 至 `chart-5` | 前五个分类实色 |
| 轻分隔与玻璃表面 | `edge-hairline` / `surface-glass` | 中性透明度色阶 |

普通组件直接使用 `bg-primary`、`text-link`、`bg-selected text-selected-foreground`。缺少用途时，先补语义映射，不在页面直接取色阶。

Button 的 `default` 与 `primary` 变体都遵守当前方言，悬停使用 `primary-hover`；`soft` 使用选中底色与文字，`link` 使用链接文字色。主要动作悬停不会把实色往背景混，前景文字对比度不低于常态。

状态实色用于填充，说明文字使用 `text-destructive-text`、`text-warning-text` 或 `text-success-text`，不把实色档直接当作小字颜色。危险按钮使用配对的 `destructive-hover`。Input 的聚焦描边取 `ring`，标签取可读的 `link` 文字档。

本站 `.dialect-public` 为阅读与展示页提供品牌动作；`.dialect-tool` 为后台、编辑器与聊天保留中性主要动作，焦点、选择、导航、链接与进度仍跟随品牌。`.dialect-immersive` 使用独立生成的固定深色灰阶，包括焦点环在内都不随主题或外观变化；它不改 `color-scheme`，状态色仍与页面其余部分一致。

## 命名主题

主题与明暗是独立的两个维度。整站替换时，在包样式之后导入命名主题：

```css
@import "tailwindcss";
@import "@violet/ui/styles.css";
@import "@violet/ui/palettes/coral.css";
```

只替换子树时，把 coral 放在包样式之前，使根作用域仍取默认 violet：

```css
@import "tailwindcss";
@import "@violet/ui/palettes/coral.css";
@import "@violet/ui/styles.css";
```

```html
<section data-theme="coral">
	<button type="button" class="v-button v-button--primary">中性主要动作</button>
	<a class="v-button v-button--link" href="/help">品牌链接</a>
</section>
```

`[data-theme]` 边界会重新绑定包内语义，避免继承父级已经求值的颜色。本站局部主题需要同时在边界选择方言，例如 `class="dialect-public" data-theme="coral"`；后代只改色阶不会自动重新求值祖先的语义变量。

## 从种子生成自己的主题

在外部项目的构建脚本中调用算法包公开入口，输出静态 CSS：

```ts
import { writeFileSync } from "node:fs";
import { generateScales, normalizeTheme, toCssVariables } from "@violetjs/theme";

const theme = normalizeTheme({ version: 1, seed: "#3a7bd5" });
const scales = (["light", "dark"] as const).flatMap((appearance) =>
	(["standard", "more"] as const).map((contrast) =>
		generateScales(theme, { appearance, contrast }),
	),
);
writeFileSync("ocean.css", toCssVariables(scales, { selector: ':root, [data-theme="ocean"]' }));
```

在包样式后导入 `ocean.css`，根语义即读取新色阶。若宿主自定义主要动作映射，须同时映射常态、悬停与前景：

```css
.campaign-theme {
	--primary: var(--brand-9);
	--primary-hover: var(--brand-10);
	--primary-foreground: var(--brand-contrast);
}
```

色阶引用只放在这样的映射层，消费组件仍使用语义变量。状态色和分类色由算法固定生成，不跟随品牌种子。

## 自定义组件外观

foundation 组件的视觉定义在独立 BEM CSS。优先通过 `className` 调整布局，或使用组件公开的 `data-slot` / `data-variant` 属性：

```css
[data-slot="button"][data-variant="primary"] {
	border-radius: var(--radius);
}
```

带变体的组件也可通过 `@violet/ui/variants` 获取稳定类名。自定义颜色用途应提供完整背景与前景语义，复用生成色阶并核验对比度；不要逐组件手写颜色。

## 滚动条

`scrollbar-thin`、`scrollbar-default`、`scrollbar-none` 与 `data-scrollbar="thin|default|none"` 控制标准滚动条属性。

| 变量 | 用途 | 默认 |
| --- | --- | --- |
| `--scrollbar-thumb` | 滑块 | 中性透明边界档 |
| `--scrollbar-track` | 轨道 | transparent |
| `--scrollbar-width` | 宽度 | thin |
| `--scrollbar-gutter` | 预留间隙 | auto |

按滚动槽覆盖语义即可：

```css
.my-scroll-area {
	--scrollbar-thumb: var(--ring);
}
```

## 相关资源

- [组件库架构](/ui/guides/architecture)：组件与主题依赖边界
- [深色模式](/ui/guides/dark-mode)：明暗切换的宿主职责
- [样式](/ui/guides/styling)：Tailwind v4 与组件变体
