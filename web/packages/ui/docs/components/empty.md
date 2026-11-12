# Empty

空状态只回答两件事：发生了什么、现在能做什么。`title` 写第一句，`description` 写第二句或当前筛选条件，`action` 给一个出口。

```tsx
import { Empty } from "@violet/ui";

<Empty
  title="还没有想法"
  description="写下第一条后会出现在这里。"
  illustration={<SeasonArt />}
  action={<Button>记一条</Button>}
/>

<Empty
  variant="plain"
  title="没有符合条件的文章"
  description="标签「Rust」· 系列「Yggdrasil」"
  action={<Button variant="outline">清除筛选</Button>}
/>

<Empty variant="compact" title="没有新消息" />
```

## 形态

- `default`：当季小幅插画、标题、说明与一个出口。插画由宿主提供（`illustration`），只作为装饰。
- `plain`：筛选无结果时不放插画，直接写清筛选条件。
- `compact`：消息面板等窄容器里只留图标和一句话；`icon` 默认收件箱，不渲染动作。

整块是 `role="status"`，内容出现时朗读一次。标题与说明是普通文字，不使用乱码、打字机或其它入场动画。

## 属性

| 属性 | 类型 | 默认值 | 约束 |
| --- | --- | --- | --- |
| `title` | `ReactNode` | — | 发生了什么 |
| `description` | `ReactNode` | — | 现在能做什么或筛选条件 |
| `illustration` | `ReactNode` | — | 仅 `default` 渲染，对读屏隐藏 |
| `action` | `ReactNode` | — | 一个出口；`compact` 不渲染 |
| `icon` | `ReactNode` | 收件箱图标 | 仅 `compact` |
| `variant` | `"default" \| "plain" \| "compact"` | `"default"` | 形态 |

错误页属于页面级版式，不在本单元内：整页 404 用大幅插画，服务错误页给重试与请求编号，区块失败就地说明影响范围。
