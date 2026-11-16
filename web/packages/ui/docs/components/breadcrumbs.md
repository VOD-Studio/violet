# Breadcrumbs

后台与文档里的层级位置。最后一级是当前页，不渲染为链接；前台的位置由导航药丸表达，不使用本单元。

## 基本用法

`nav aria-label="当前位置"` 里放 `ol`，分隔符 `/` 对读屏隐藏。当前页用 `span aria-current="page"`，名称过长时截断并保留 `title` 供悬停查看。

```tsx
import { Breadcrumbs } from "@violet/ui";

<Breadcrumbs
  items={[
    { label: "内容", href: "/admin" },
    { label: "文章", href: "/admin/posts" },
    { label: "拆解 Saber" },
  ]}
/>
```

## 折叠与窄屏

超过四级时中间层级折进「…」按钮（28 × 24 的圆钮），第一级与最后两级始终显示；菜单沿用 `dropdown-menu` 的面板与项，触发钮名称写「展开中间的 N 级」，并带 `aria-expanded`。`menuContainer` 用于宿主指定菜单挂载容器。

容器小于 23rem 时隐藏完整层级，只留「‹ 上一级」的返回链接。上一级没有 `href` 时不渲染返回链接。

## 属性

| 属性 | 类型 | 默认值 | 约束 |
| --- | --- | --- | --- |
| `items` | `BreadcrumbItem[]` | — | `label` 是纯文本；最后一项忽略 `href` |
| `menuContainer` | `HTMLElement \| null` | — | 折叠菜单的挂载容器 |

叶子 CSS 已引入 `dropdown-menu`，单独加载 `components/breadcrumbs.css` 也能展开菜单。
