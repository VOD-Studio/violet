# Icons 图标

全站只有一套线框图标：lucide 的形，按项目的网格、线宽和尺寸使用；项目自己需要的三个形状画进本单元，和 lucide 图标放在一起看不出区别。图标本身不带颜色、不带语义，颜色跟着文字走。

```tsx
import { iconProps } from "@violet/ui";
import { CircleAlert } from "lucide-react";

<CircleAlert {...iconProps(14)} />;
```

## 尺寸与线宽

`iconProps(size?, className?)` 是显式尺寸档的唯一入口：返回 `{ size, strokeWidth, className }`，直接展开到 lucide 图标或自绘图标上。省略尺寸时取 16；返回的 `className` 包含稳定标记 `v-icon`，让 Button、Input、菜单与列表的默认图标槽不再覆盖显式档位。附加类名放在第二个参数里，不要在展开后另写 `className` 丢掉标记：

```tsx
<CircleAlert {...iconProps(14, "text-destructive")} />
```

| 尺寸 | 线宽 | 用在 |
| --- | --- | --- |
| 12 | 2 | 元信息：时间、浏览数、表格里的小标记 |
| 14 | 2 | 行内文字旁、小号按钮、标签 |
| 16 | 1.75 | 默认：按钮、菜单项、输入框、列表 |
| 18 | 1.75 | 工具栏、轻提示、对话框的关闭按钮 |
| 20 | 1.75 | 触屏、导航、抽屉列表、上传面板 |
| 24 | 1.75 | 空状态、功能说明、拖放区 |

同一行、同一个工具栏里只用一档。14 及以下之所以把线宽提到 2，是让缩小后的笔画不至于细到发虚。

控件槽只为没有 `v-icon` 标记的普通图标补默认值：按钮 `sm` / `md` 为 16、`lg` 为 20，输入框前置图标同为 16 / 16 / 20，其余普通输入槽、菜单项和列表为 16；这些默认档线宽都是 1.75。显式 `iconProps(12)` / `iconProps(14)` 在这些槽中仍保持 12 / 14 与线宽 2，其余四档保持各自尺寸与线宽 1.75。输入框的清除图标显式使用 14 档；菜单内部 checkbox / radio 的勾选标记是独立状态图形，保留稿中的线宽 2.2 / 4，不按普通动作图标重置。加载圆弧由 `indicator` 单元负责，也不受普通图标槽重置。

组件稿明确规定的内部图形保持本单元尺寸：例如表情选择器页签为 17px，由该单元的图标槽约束，不用 `iconProps(18)` 声称另一档。

Tag 与 Badge 的图标槽默认为 12px，带 `.lucide` 类的图标（含本单元三款自绘图标）使用线宽 2；带 `v-icon` 的显式档位保留原值。槽内非 lucide 的任意 SVG（如品牌标志）不强制描边。

## 宿主默认值

脱离控件槽的普通 lucide 图标由 lucide 原生 `LucideProvider` 提供默认值，不增加包装 Provider。宿主在模块级取一次默认档，只把 `size` 和 `strokeWidth` 交给 Provider：

```tsx
import { iconProps } from "@violet/ui";
import { CircleAlert, LucideProvider } from "lucide-react";

const defaultIconProps = iconProps();

function App() {
  return (
    <LucideProvider
      size={defaultIconProps.size}
      strokeWidth={defaultIconProps.strokeWidth}
    >
      <CircleAlert />
      <CircleAlert {...iconProps(12, "text-muted-foreground")} />
    </LucideProvider>
  );
}
```

Provider 只设未指定属性时的默认值，图标自身的属性优先。不要把 `iconProps()` 整体展开到 Provider，也不要给 Provider 的 `className` 设置 `v-icon`：lucide 会把 context 类名合并到所有后代图标，导致原本应跟随大按钮或大输入框变成 20 的默认图标被误认成显式档位。Provider 的默认值、控件槽的尺寸规则与显式 helper 各司其职；本单元不包装 lucide 组件，也不通过全局 `svg` 或 `.lucide` 样式重置图标。

## 网格

所有图标画在 24 × 24 的网格里，四周留 2 的安全区，内容不出安全区。基准形：圆直径 20、方 18 × 18、横 20 × 16、竖 16 × 20，圆角 2 起。端点与拐角全部圆头圆角。只用线框，实心只出现在状态小圆点、播放三角这类本身就是实体的部分。

## 颜色与状态

颜色一律 `currentColor`：平时是浅一档的灰，悬停变墨色，选中用季节色。只有表示结果的状态图标（成功、出错、警告、信息）带颜色，且颜色只给图标，不给底色；这类图标只出现在轻提示、内联提示和表格状态里。

## 与文字的间距

图标与文字垂直居中，按视觉中心对齐。间距按位置取：按钮 8、菜单项 12（同类菜单的图标列对齐）、元信息 4（元信息组与组之间 12）。

## 自绘图标

lucide 里没有、项目自己的三个：`IslandIcon`（顶栏 logo 药丸里的实时状态）、`TimelineIcon`（手记按天的时间线）、`MorphIcon`（变形弹出层：按钮长成面板）。

| 图标 | 导出 | 形状 |
| --- | --- | --- |
| 灵动岛 | `IslandIcon` | 20 × 8 的胶囊贴安全区左右边，右侧 1.5 的圆点是状态，不填实心 |
| 时间线 | `TimelineIcon` | 节点 r 2，竖线在节点处断开 2、不穿过圆，右侧两条长短不同的线表示条目 |
| 变形 | `MorphIcon` | 外框圆角 4 是面板，左上的小胶囊是原来的按钮 |

三者与 lucide 图标同网格、同 `currentColor`，不传属性时为 16、线宽 1.75；显式尺寸和线宽同样由 `iconProps` 决定。保留原生 SVG 属性、ref 与 lucide 的可访问性行为。加载转圈由 `indicator` 单元承担，不用图标。

## 可访问性

图标默认 `aria-hidden="true"`：旁边的文字已经表达了含义，读屏不该再念一遍图标名。只有图标按钮必须有 `aria-label`，写动作名（「关闭」而不是「X」），可以再用 `title` 给出文字提示。图标需要独立名称时才传 `aria-label` 或 `title`，不要留空的 `role="img"`。

## 入口

从 `@violet/ui` 或 `@violet/ui/icons` 导入 `iconProps`、`IconSize`、`IconProps`、`IslandIcon`、`TimelineIcon`、`MorphIcon`、`GithubIcon`、`GoogleIcon`。`GithubIcon` 与 `GoogleIcon` 是品牌标志，用实心路径与品牌色，不走线框规范。

lucide 图标不经过本包转导出，调用方直接 `import { CircleAlert } from "lucide-react"`；默认值用原生 `LucideProvider`，显式档位用 `iconProps`。