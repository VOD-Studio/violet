# Chart

两个层面：Recharts 外壳的主题接线，以及统计数字与只给趋势的迷你图。分类色由调用方配置为 `--chart-1` 到 `--chart-5` 或语义色，组件不引入新色值。

## 统计数字

```tsx
import { MiniBars, Stat } from "@violet/ui";

<Stat
  label="近 7 天访问"
  value="12,480"
  change={{ direction: "up", value: "18%" }}
  trend={[820, 940, 900, 1180, 1320]}
/>
```

数字用等宽大号；变化量带箭头和颜色，箭头才是信息。整项以一句完整的话作为读屏名称（含比较方向），趋势线对读屏隐藏。

## 迷你柱状图

```tsx
<MiniBars
  unit="访问"
  data={[
    { label: "周一", value: 1200 },
    { label: "周二", value: 980 },
    { label: "周三", value: 1420 },
  ]}
/>
```

不放坐标轴、网格与图例；指针移到一根柱子时它变墨色，上方浮出具体数。图形对读屏隐藏，同样信息由根节点的 `aria-label` 提供（可用 `summary` 覆盖）。`formatValue` 控制数值格式。

## Recharts 外壳

`ChartContainer` 保留原有 API：调用方传 `config`（`label` 与 `color`）和 Recharts 子元素，颜色经 CSS 变量注入。`ChartTooltipContent`、`ChartLegendContent` 的视觉改由组件 CSS 维护，分类色仍取调用方配置。

| 属性 | 类型 | 默认值 | 约束 |
| --- | --- | --- | --- |
| `label` / `value` | `string` | — | 统计项名称与已格式化数值 |
| `change` | `{ direction: "up" \| "down"; value: string; note?: string }` | — | 与上一期的比较 |
| `trend` | `number[]` | — | 至少两个点才画趋势线 |
| `data` | `{ label: string; value: number }[]` | — | 迷你柱状图数据 |
| `formatValue` | `(value: number) => string` | 本地数字格式 | 数值格式 |
| `unit` | `string` | — | 悬停提示里的单位 |
| `summary` | `string` | 自动生成 | 读屏摘要 |

柱状图悬停颜色 120ms、提示浮出 150ms；减弱动态下直接切换。
