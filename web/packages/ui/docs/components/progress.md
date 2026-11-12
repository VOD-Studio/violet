# Progress

知道百分比时的条形与圆环。不知道百分比或只是整块等待时使用指示器，不用进度条冒充不确定状态。

## 进度条

```tsx
import { ProgressBar, ProgressRing } from "@violet/ui";

<ProgressBar
  value={42}
  label="上传 cover-season.webp"
  hint="42 / 100 MB"
  segments={{ count: 5, active: 3 }}
/>
```

`label` 同时作为 `progressbar` 的可访问名称；省略时必须传 `aria-label`。`hint` 写完成、失败或等待的补充说明。`segments` 只补充阶段信息（如「第 3 / 5 个阶段」），不替代 `aria-valuenow`。

## 圆环与状态

```tsx
<ProgressRing value={65} label="本月阅读目标" description="已读 13 / 20 篇" />
```

圆环 48 或 32，线宽 4 或 3，起点在正上方顺时针；数字写在圆心。`status="success"` 变成功色并把读屏值写成「已完成」，`status="error"` 变危险色并写成「63%，失败」。颜色只做辅助，结果由文字说明。

进度条前进用 `scaleX` 过渡 300ms，不改宽度；颜色变化 200ms。减弱动态下直接跳到新值。

## 属性

| 属性 | 类型 | 默认值 | 约束 |
| --- | --- | --- | --- |
| `value` | `number` | — | 0–100，超出范围按边界处理 |
| `label` | `ReactNode` | — | 正在做什么；省略时传 `aria-label` |
| `hint` | `ReactNode` | — | 补充说明 |
| `status` | `"process" \| "success" \| "error"` | `"process"` | 结果语气 |
| `segments` | `{ count: number; active: number }` | — | 仅条形 |
| `size` | `32 \| 48` | `48` | 仅圆环 |

两个组件都保留根元素的 `className`、`style` 与事件；进度语义在内部的 `role="progressbar"` 元素上。
