# Steps

三到五步的流程指示。`current` 指定进行到第几步（从 0 开始），之前的步骤自动视为已完成，之后的步骤是未到。更多步骤拆成阶段，不把一条流程拉长。

## 结构与状态

`ol` / `li` 表达顺序；当前一步的 `li` 带 `aria-current="step"`。每一步有一份只给读屏的状态文本（已完成、进行中、未开始、出错），视觉状态由圆点、对勾与连线表达，不依赖颜色单独传达信息。

```tsx
import { Steps } from "@violet/ui";

<Steps
  current={1}
  steps={[
    { title: "填写信息", description: "作者与标题" },
    { title: "验证站点" },
    { title: "发布" },
  ]}
/>
```

`orientation="vertical"` 用于说明较长或放在侧栏的流程；连线在圆点之间，走过的部分是墨色。

## 可点与出错

只有已完成的步骤可以点回去，且必须传 `onStepClick`；未到与当前步骤的圆点不可交互。圆点的可访问名称写完整状态：「第 1 步，填写信息，已完成」。

`tone="error"` 把当前一步变成危险色与「!」，已验证的步骤与 `aria-current` 不变。组件不阻止继续操作，由宿主决定是否允许重试或跳转。

## 属性

| 属性 | 类型 | 默认值 | 约束 |
| --- | --- | --- | --- |
| `steps` | `StepItem[]` | — | `title` 是纯文本，用于可访问名称；`description` 可省略 |
| `current` | `number` | — | 0 起的当前步骤 |
| `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | 横排按等分栅格，竖排按行 |
| `tone` | `"process" \| "error"` | `"process"` | 只影响当前一步 |
| `onStepClick` | `(index: number) => void` | — | 传了才允许点已完成的步骤 |

其余 `ol` 属性（`aria-label`、`className`、`ref`）原样透传。前进时连线 200ms、圆点 140ms，减弱动态下直接切换。
