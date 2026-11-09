# PageHeader

页面顶部的位置、标题、一句事实说明与右侧操作。后台每页一个；详情页可在左上放返回，在标题后放状态。

## 组成

```tsx
import { Breadcrumbs, PageHeader, Tabs, TabsList, TabsTrigger } from "@violet/ui";

<PageHeader
  title="文章"
  breadcrumbs={<Breadcrumbs items={[{ label: "内容", href: "/admin" }, { label: "文章" }]} />}
  description="共 270 篇，3 篇待发布"
  actions={<button type="button">导出</button>}
  primaryAction={<button type="button">写文章</button>}
/>
```

标题是页面唯一的 `h1`。`actions` 放次要操作（最多两个），`primaryAction` 放唯一主操作；`tabs` 放平级分区，贴着页头底边。详情页传 `back={{ href, label }}`，链接的可访问名称是「返回{label}」；`status` 跟在标题后，`meta` 放保存时间、字数等结构化信息。

## 窄条形态

滚动后由宿主把 `compact` 置为真：页头变成 56 高的粘性窄条，只留标题、`compactSummary` 与主操作，隐藏返回、面包屑、说明、状态、次要操作与标签页。

窄条与完整页头共用同一份 DOM，不复制标题和操作，所以读屏只读一次，也不会出现不可见的重复焦点。组件不监听滚动；宿主按自己的滚动容器切换 `compact`。

## 属性

| 属性 | 类型 | 默认值 | 约束 |
| --- | --- | --- | --- |
| `title` | `string` | — | 页面唯一 `h1` |
| `description` / `meta` | `ReactNode` | — | 说明写事实，不写口号 |
| `breadcrumbs` | `ReactNode` | — | 通常传 `<Breadcrumbs />` |
| `actions` | `ReactNode` | — | 次要操作，窄条中隐藏 |
| `primaryAction` | `ReactNode` | — | 唯一主操作，窄条中保留 |
| `tabs` | `ReactNode` | — | 平级分区 |
| `back` | `{ href: string; label: string }` | — | 详情页返回 |
| `status` | `ReactNode` | — | 标题后的状态徽章 |
| `compact` | `boolean` | `false` | 由宿主按滚动位置切换 |
| `compactSummary` | `ReactNode` | — | 窄条标题后的摘要 |

完整页头与内容间距 32。窄条淡入 180ms，减弱动态下直接切换。
