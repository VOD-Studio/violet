# AnnouncementBar 公告浮条

站点级公告的展示单元：一句话、可选链接、右侧关闭钮。宽度跟着内容走，自身不占页面高度；定位、多条轮换与已读记录的保存由宿主负责。

```tsx
import { AnnouncementBar } from "@violet/ui";

<AnnouncementBar
  content="评论编辑器即将支持 Markdown 实时预览"
  link={{ href: "/announcements/12", label: "查看详情" }}
  severity="info"
  onClose={() => dismissCurrent()}
/>;
```

## 属性与语义

| 属性 | 契约 |
| --- | --- |
| `content: ReactNode` | 必填，一句话公告正文；放不下时尾部省略，不换行。 |
| `link?: AnnouncementBarLink` | 可选链接，渲染为原生 `<a>`，`href` 原样交给浏览器；不传就没有链接元素。 |
| `severity?: "info" \| "warning" \| "success" \| "error"` | 只换指示点颜色，默认 `info`。写成 `data-severity`，供 CSS 取值。 |
| `onClose: () => void` | 必填，关闭钮的点击回调；组件不自己隐藏，也不写入已读记录。 |
| `ref / className / style / id / 事件` | 全部属于根 `HTMLDivElement`；`className` 用于宿主约束宽度或定位。 |

左侧指示点带 `aria-hidden`，语气由正文自身表达。关闭钮是原生 `button`，可访问名称固定为「关闭公告」，Tab 可聚焦、Enter/Space 触发。组件不拦截页面滚动，也不创建遮罩或浮层容器。

## 视觉与动效

宽度由内容决定，上限 `min(560px, 100%)`；圆角取 `--radius` 且不超过 16px，浮起只用 `0 4px 24px / 0.05` 软影，底色是 `--surface-glass` 加 12px 背模糊。淡入 180ms 只动透明度，不使用位移或缩放。关闭后的淡出、轮换的淡入淡出与「不向上收起」由宿主完成，组件不改变自身高度。

系统偏好 `prefers-reduced-motion: reduce` 与宿主的 `[data-motion="reduce"]` 作用域下都取消淡入与颜色过渡，条体直接呈现完整内容。

## 样式入口

从 `@violet/ui` 或 `@violet/ui/announcement-bar` 导入组件与 props 类型。

```css
/* 普通 CSS 宿主 */
@import "@violet/ui/tokens.css";
@import "@violet/ui/components/announcement-bar.css";
```

Tailwind v4 宿主在 Tailwind 后导入 `@violet/ui/styles.css`。React 与纯 HTML 共用 `.v-announcement-bar` 以及 `__dot`、`__label`、`__text`、`__link`、`__close` 类。

## 不该用它的地方

页面里的提醒用 `Alert`，操作结果用轻提示；公告浮条只承担站点级通知。多条公告的排序、轮换间隔、悬停与聚焦暂停、已读记录都与业务数据绑定，留在宿主适配层，不进组件。