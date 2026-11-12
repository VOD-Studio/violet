# Alert

留在页面里的内联提示，四种语气：信息、成功、警告、危险。底色只淡淡染上语气色，不加边框和色条；危险提示只有图标是红色，标题仍是墨色。

```tsx
import { Alert } from "@violet/ui";

<Alert
  tone="warning"
  title="封面尺寸偏小"
  description="建议宽度不小于 1600px，否则分享卡片会模糊。"
  action={{ label: "换一张", onClick: pickImage }}
  onDismiss={() => setHidden(true)}
/>
```

## 语气与结构

`title` 是一句话，`description` 补充「发生了什么」或「现在能做什么」，`action` 最多一个文字动作。危险语气使用 `role="alert"` 立即朗读，其余用 `role="status"`；图标是装饰，语气靠标题文字表达。

`compact` 用于表单或卡片里的一行提示：只留图标和一句话，不渲染标题结构、动作与关闭钮。

## 关闭

传 `onDismiss` 或显式 `dismissible` 时显示 28 的关闭圆钮。点击后淡出 140ms、收起高度 200ms，再把焦点交给提示之后的下一个可聚焦元素，最后调用 `onDismiss`；减弱动态下直接消失。宿主不需要自己实现退场动画。

## 属性

| 属性 | 类型 | 默认值 | 约束 |
| --- | --- | --- | --- |
| `tone` | `"info" \| "success" \| "warning" \| "danger"` | `"info"` | 语气 |
| `title` | `ReactNode` | — | 一句话标题 |
| `description` | `ReactNode` | — | 补充说明 |
| `action` | `{ label; onClick?; href? }` | — | 一个文字动作 |
| `onDismiss` | `() => void` | — | 传了才显示关闭钮 |
| `dismissible` | `boolean` | 由 `onDismiss` 决定 | 强制显示或隐藏关闭钮 |
| `compact` | `boolean` | `false` | 一行形态 |

页面级公告用导航下方的浮条，操作的即时结果用轻提示，字段错误写在表单项里；这些场景不使用 Alert。
