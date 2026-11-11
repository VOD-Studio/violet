# QuoteCard 引用卡

站内内容的引用摘要：作者、时间、两行正文和一张缩略图。整张卡只有一处链接，被引用的内容无论是推文还是聊天分享都用这一张；组件只接收展示字段，不认识推文 DTO、路由、查询或灯箱。

```tsx
import { QuoteCard } from "@violet/ui";

<QuoteCard
  href="/tweets/9f2c"
  label="查看 xunrua 的这条推文"
  authorName="xunrua"
  authorAvatar="/uploads/avatar.webp"
  time="2 小时前"
  timeTitle="2026-11-10 09:12"
  content="给博客加了季节。春天落桃花，秋天落桂花，冬天的雪会积在导航上。"
  imageSrc="/uploads/season-thumb.webp"
/>
```

## 属性

| 属性 | 契约 |
| --- | --- |
| `href?: string` | 被引用内容的地址。省略时只展示内容，不生成链接——发布器预览这类不应离开当前页的语境用它。 |
| `label?: string` | 链接的可访问名称；正文为空时必须提供，否则链接没有可读的文字。 |
| `authorName?: string` | 作者名，13px/600；删除态不渲染。 |
| `authorAvatar?: string` | 20px 圆形头像，装饰图，名字已由 `authorName` 朗读。 |
| `time?: string` | 已格式化的相对时间，组件不解析日期。 |
| `timeTitle?: string` | 时间的完整文案，作为 `<time>` 的原生 title。 |
| `content?: string` | 正文，最多两行，保留换行。 |
| `imageSrc?: string` | 正文右侧的单张缩略图，64×64、圆角 8；不提供时正文占满宽度。 |
| `nested?: string` | 被引用内容自身又引用了别的推文时的一行提示，不再嵌套第二张卡。 |
| `deleted?: boolean` | 原文已删除：只留一行说明，不渲染作者、时间与缩略图，整卡不可点也不可聚焦。 |
| `deletedLabel?: string` | 删除态说明，默认「原推文已删除」。 |
| `action?: ReactNode` | 右上角的附加操作（如取消引用），自动浮在覆盖层之上。 |
| `renderLink?: (props) => ReactElement` | 站内路由用它替换原生 `<a>`，保留客户端导航。 |
| `ref / className / style` | 全部属于根 `HTMLDivElement`，ref 支持对象、回调及 React 19 清理函数。 |

## 唯一原文链接与预览操作

正文链接带 `.v-quote-card__link::after` 伪元素，`inset: 0` 把点击区扩到整张卡，所以卡上的空白处、作者行、缩略图都落在同一个链接里。作者是展示信息，不另设个人主页链接。`action` 槽浮在覆盖层之上，取消引用等按钮仍可单独点击；组件不给根节点挂 `onClick` 或 `role="button"`。

`renderLink` 拿到的 `className` 是覆盖层的挂载点，自定义元素必须原样展开它，否则点击区只剩正文那一段：

```tsx
import { Link } from "@tanstack/react-router";

<QuoteCard
  href="/tweets/9f2c"
  label="查看这条推文"
  content="……"
  renderLink={(props) => (
    <Link to="/tweets/$id" params={{ id: "9f2c" }} className={props.className} aria-label={props["aria-label"]}>
      {props.children}
    </Link>
  )}
/>
```

## 视觉与动效

纸色底、发丝边、圆角 12、软影，内边距 12×14；头部件间距 8，正文与缩略图间距 12。悬停只给作者名与正文加下划线，卡片不位移、不缩放。键盘焦点是包住整卡的 2px 强调色环，`outline-offset: 2px`，根节点不裁剪；宿主不要把卡片放进裁掉外溢的容器。

删除态去掉软影、底色换成凹陷色，只保留一行灰色说明与 16px 图标。减弱动态（系统偏好或宿主的 `data-motion="reduce"`）下取消下划线过渡。

## 真实消费边界

- 推文列表、详情来源栏与聊天消息统一使用原文路由链接；删除来源只渲染 `deleted`，不保留作者、时间、缩略图或链接。
- 聊天待发送与推文发布器预览不传 `href`，避免误触离开编辑；取消引用按钮仍由宿主持有，发送状态不交给引用卡。
- 二级引用一律只传「引用了一条推文」，即使更深层目标已经删除也不改成当前卡的删除态。服务端的 `QuotedTweetDTO.quote_of` 和聊天 `SharedTweetDTO.quote_of` 只保留这一层关系标记，不获取或展开更深层正文；无引用时省略字段。
- 分享预览读取当前原文返回 404 时显示删除态，网络或其他读取失败仍显示错误反馈。

## 样式入口

从 `@violet/ui` 或 `@violet/ui/quote-card` 导入组件与类型。

```css
/* 普通 CSS 宿主 */
@import "@violet/ui/tokens.css";
@import "@violet/ui/components/quote-card.css";
```

React 与纯 HTML 共用 `.v-quote-card` 以及 `__header`、`__author`、`__avatar`、`__name`、`__time`、`__action`、`__link`、`__body`、`__column`、`__text`、`__nested`、`__image`、`__deleted`、`__icon` 类。卡片宽度由宿主给，组件本身撑满可用宽度。

站点 `/ui?open=quote-card` 陈列被引用推文、聊天分享、嵌套、发布器预览与删除五种状态；预览可取消并重新引用，占地统一为 520×180。