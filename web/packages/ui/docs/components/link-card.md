# LinkCard 链接预览

紧凑的原生链接：左侧方形缩略图，右侧标题、说明和轻量来源。组件只接收展示字段，不认识推文 DTO、站点 API 或路由；抓取、缓存、图片代理和加载状态由消费方负责。

```tsx
import { LinkCard } from "@violet/ui";

<LinkCard
  href="https://example.com/guide"
  title="组件设计指南"
  description="原生语义、交互和样式边界。"
  siteName="Example Journal"
  imageSrc="https://example.com/guide.png"
  imageAlt="指南封面"
/>
```

## 属性与导航

| 属性 | 契约 |
| --- | --- |
| `href: string` | 原生链接地址；组件不拦截导航，不修改 fragment 或 query。 |
| `title: string` | 必填展示标题，也作为原生 title 提示；最多两行。缺失标题的业务兜底由调用方决定。 |
| `description?: string` | 最多两行；与标题经 Unicode 规范化、忽略大小写、空白和标点符号后相同，则不显示。 |
| `siteName?: string` | 来源名称；与链接域名相同（忽略 www 前缀及大小写）时只显示域名。 |
| `imageSrc?: string` | 可选缩略图；图片失败后连同图位一起移除。 |
| `imageAlt?: string` | 默认空字符串，作为装饰图；需要额外图片信息时显式提供。 |
| `ref / className / style` | 全部属于根 `HTMLAnchorElement`，ref 支持对象、回调及 React 19 清理函数。 |
| `target / rel / onClick / onAuxClick` | 保留原生属性和取消语义；默认新标签，rel 为 `noopener noreferrer nofollow`。可显式覆盖。 |

Tab 聚焦，Enter 导航；Ctrl/Cmd 点击、中键、右键菜单和 `preventDefault()` 都保持浏览器或消费方的行为。组件不模拟 Space 激活、不创建按钮，也不嵌套交互元素。内容由预览字段生成，不提供 `children` 或 `dangerouslySetInnerHTML`。

相对地址同样可导航，但不从客户端 location 猜测域名，因此服务端与客户端首帧一致。跨域或新标签策略由宿主选择；组件不会校验、请求或重写 href。

## 图片与内容变化

桌面缩略图宽 96px，卡片内容宽度不超过 384px 时宽 80px；图位与卡片左缘相接，使用 `object-fit: cover`。无图或图片错误时，文字占满可用宽度。常态描边保持不变，hover 只轻微改变背景，不高亮边框；键盘焦点环独立保留。

失败图片不会因普通重渲染反复重试；`imageSrc`、`href`、`title` 或 `description` 改变后开始新的图片周期，可以从降级状态恢复。图片默认懒加载，声明宽高，不等待图片加载才展示文字。服务端输出完整链接内容，水合不依赖浏览器尺寸或 location。

## 样式入口

从 `@violet/ui` 或 `@violet/ui/link-card` 导入组件与 `LinkCardProps`。

```css
/* 普通 CSS 宿主 */
@import "@violet/ui/tokens.css";
@import "@violet/ui/components/link-card.css";
```

Tailwind v4 宿主在 Tailwind 后导入 `@violet/ui/styles.css`。React 与纯 HTML 共用 `.v-link-card` 以及 `__thumbnail`、`__image`、`__body`、`__title`、`__description`、`__meta`、`__site`、`__host` 类。

组件 CSS 自行约束长文字、窄容器、明暗主题与两行截断。卡片自身不裁剪焦点环；截断只发生在不可聚焦的文字或图片部件。圆角不超过 16px，不使用阴影、缩放或位移动效，减弱动态时取消颜色过渡。宿主不要把链接放进没有焦点留白的裁剪层。

独立 tarball consumer 的 `?preview=link-card` 提供 logo、封面、坏图、无图、内容更新、聚焦、明暗和窄屏场景；对应同源示例发布于 `/ui/components/link-card`。
