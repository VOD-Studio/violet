# API 参考

[English](./api.md) · [中文 README](../README.zh-CN.md)

下列组件与数据类型均由 `@violetjs/react-tweet` 和 `@violetjs/react-tweet/unstyled` 导出；前者导入 CSS，后者不导入。`/api` 只导出 `getTweet`、`parseTweetId`、`GetTweetOptions`。不提供 CommonJS 入口。`/styles.css` 是完整默认样式，`/package.json` 暴露包元数据。

## 组件

### `EmbeddedTweet(props: EmbeddedTweetProps)`

展示已保存的 `TweetData`，不请求推文正文、脚本或 iframe；浏览器仍请求媒体资源。

| 属性 | 类型 | 默认值 / 语义 |
| --- | --- | --- |
| `tweet` | `TweetData` | 必填：快照或明确不可用状态。 |
| `compact` | `boolean` | `false`；紧凑内边距。 |
| `locale`、`timeZone`、`messages`、`maxTextLines` | `TweetDisplayOptions` | 见展示配置。 |
| `renderPhotos`、`renderVideo`、`onOpenPhoto` | `TweetMediaRenderers` | 见媒体扩展。 |
| 原生 article 属性 | `Omit<ComponentPropsWithRef<"article">, "children" \| "dangerouslySetInnerHTML">` | 包括 `id`、`ref`、`className`、`style`、ARIA、data 属性和事件。 |

根节点为 `article`。正文点击冒泡；链接与媒体独立处理交互，不吞掉宿主 portal 中的事件。`aria-label` 可覆盖本地化默认名称。`data-state` 为 `available`、`unavailable`、`deleted` 或 `private`。

不可用状态不展示正文和引用，即使外部非法数据带有残留快照。引用最多展开一层，更深层仅保留来源链接。底栏按来源数据显示点赞、回复、转发和发布时间；点赞/回复在新标签页打开真实 X 操作入口，转发为只读计数，不伪造本地互动结果。

### `Tweet(props: TweetProps)`

客户端加载组件。SSR 输出加载骨架，不输出抓取后的正文。

| 属性 | 类型 | 语义 |
| --- | --- | --- |
| `id` | `string` | 必填：推文 ID 或 X/Twitter 原文 URL，不是 DOM `id`。 |
| `fetcher` | `TweetFetcher` | 必填的宿主加载器，应保持引用稳定。 |
| 展示与媒体属性 | `TweetDisplayOptions & TweetMediaRenderers` | 与 `EmbeddedTweet` 相同。 |
| 原生 article 属性 | `Omit<ComponentPropsWithRef<"article">, "children" \| "dangerouslySetInnerHTML" \| "id">` | 透传到加载/错误节点或成功卡片。 |

`Tweet` **不接受** `compact`。挂载、ID/fetcher 改变、手动重试时发起请求。替换请求或卸载会取消 signal；即使加载器忽略取消，迟到结果也会被丢弃。加载新请求时立即隐藏旧内容。异常展示来源链接与重试按钮，明确不可用的结果不自动重试。加载/错误根节点带 `data-state="loading"` / `"error"`、`aria-busy` 与 `role="status"` 状态文案，骨架尊重减少动态效果偏好。

```ts
interface TweetFetcherOptions { signal: AbortSignal }
type TweetFetcher = (id: string, options: TweetFetcherOptions) => Promise<TweetData>;
```

缓存、认证、响应校验、端点选择由宿主实现。包不提供 HTTP 端点或缓存。不要在浏览器直接调用 `getTweet`。

### `TweetCard(props: TweetCardProps)`

来源无关的布局，不自动添加 X 标识、来源链接、本地化或请求。

| 属性 | 类型 | 默认值 / 语义 |
| --- | --- | --- |
| `headerSlot` | `ReactNode` | 作者/页眉。 |
| `contentSlot` | `ReactNode` | 正文。 |
| `mediaSlot` | `ReactNode` | 媒体。 |
| `quoteSlot` | `ReactNode` | 引用内容；非 null/undefined/false 时增加引用间距容器。 |
| `footerSlot` | `ReactNode` | 底栏。 |
| `compact` | `boolean` | `false`；紧凑内边距。 |
| `isQuoted` | `boolean` | `false`；引用卡片边框、排版和间距。 |
| 原生 article 属性 | 与 `EmbeddedTweet` 相同 | 透传至根节点。 |

插槽按表格顺序渲染，均可选。`isQuoted` 用于真实的嵌套卡片，不是引用占位条。宿主负责插槽的语义和交互。

## 展示配置

`TweetDisplayOptions` 由 `Tweet` 与 `EmbeddedTweet` 共用：

| 字段 | 类型 | 默认值 / 行为 |
| --- | --- | --- |
| `maxTextLines` | `number?` | `6`；正整数限制正文行数，零、负数、小数和非有限数关闭折叠。 |
| `locale` | `string?` | `"en-US"`；数字日期格式和内置消息选择。 |
| `timeZone` | `string?` | `"UTC"`；无效时区回退 UTC。 |
| `messages` | `Partial<TweetMessages>?` | 覆盖部分内置文案。 |

内置英文与简体中文。其他有效 locale 仍格式化对应语言的数字日期，但未覆盖的消息使用英文。非法语言标签安全回退。不读取服务器本地时区或浏览器语言；水合两侧使用相同 locale、timeZone、数据和消息覆盖。

外层与引用正文独立折叠，不折叠媒体/操作。SSR 保留完整正文与链接并应用折叠样式，挂载测量后仅为实际溢出内容增加展开按钮；窗口和字体变化会重新测量。作者原文和 `warnings` 不被翻译，也不按 HTML 解析。

### `TweetMessages`

每个字段都是 `string`。覆盖部分文案用 `Partial<TweetMessages>`，新语言可提供完整词典。占位符替换为已本地化的数字，不解释为 HTML。

| 键 | 用途 / 占位符 |
| --- | --- |
| `tweetLabel` | article 默认可访问名称。 |
| `source` | 原文链接。 |
| `loading` | 读屏加载状态。 |
| `error` | 可重试错误。 |
| `retry` | 重试按钮。 |
| `unavailable` | 原因不明的不可用状态。 |
| `deleted` | 来源明确确认的删除状态。 |
| `private` | 来源明确确认的私密状态。 |
| `verified` | 个人认证徽章名称。 |
| `verifiedBusiness` | 企业认证徽章名称。 |
| `verifiedGovernment` | 政府认证徽章名称。 |
| `affiliation` | 缺少组织名称时的关联徽标名称。 |
| `likeAction` | X 点赞操作名称。 |
| `replyAction` | X 回复操作名称。 |
| `showMore` | 展开正文按钮。 |
| `showLess` | 收起正文按钮。 |
| `quote` | 引用来源链接。 |
| `photo` | 照片默认替代文字，`{index}`。 |
| `viewPhoto` | 原图链接名称，`{index}`。 |
| `photoRail` | 横向照片条名称，`{count}`。 |
| `previousPhotos` | 上一组照片按钮。 |
| `nextPhotos` | 下一组照片按钮。 |
| `imageUnavailable` | 照片加载失败。 |
| `videoPoster` | 视频封面默认替代文字。 |
| `videoPosterUnavailable` | 视频封面加载失败。 |
| `video` | 原生视频播放器名称。 |
| `animation` | 原生动图播放器名称。 |
| `viewVideo` | 视频来源链接/播放失败回退。 |
| `replies` | 回复统计名称，`{count}`。 |
| `reposts` | 转发统计名称，`{count}`。 |
| `likes` | 点赞统计名称，`{count}`。 |
| `poll` | 提示在来源查看投票。 |
| `article` | 提示在来源查看 X 长文章。 |
| `incompleteText` | 正文可能截断。 |
| `unsupportedMedia` | 不支持的媒体提示。 |
| `unavailableMedia` | 媒体缺失或被过滤。 |

## 数据模型

`?` 表示可选，只有明确写了 `| null` 的字段接受 null。下列类型均公开导出。

### `TweetData`、`AvailableTweet`、`UnavailableTweet`、`TweetAvailability`

```ts
type TweetAvailability = "available" | "unavailable" | "deleted" | "private";
type TweetData = AvailableTweet | UnavailableTweet;
interface AvailableTweet {
  id?: string;
  url: string;
  availability: "available";
  snapshot: TweetSnapshot;
  quotedTweet?: TweetData | null;
}
interface UnavailableTweet {
  id?: string;
  url: string;
  availability: "unavailable" | "deleted" | "private";
  snapshot?: never;
  quotedTweet?: never;
}
```

空正文可承载纯媒体推文，不能用缺少快照表达加载中。`id` 是正十进制 X 标识，`url` 是来源地址。一般展示地址接受 HTTP(S) 和同源根相对路径；拒绝危险协议、协议相对地址、凭证、空白/控制字符和反斜线；来源链接可回退到有效 ID 生成的地址。

### `TweetSnapshot`

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `author` | `TweetAuthor` | 必填作者。 |
| `text` | `string` | 必填完整纯文本，可以为空。 |
| `segments` | `TweetSegment[] \| null`（可选） | 有序富文本片段；非空时用于展示。 |
| `publishedAt` | `string?` | ISO 时间按显式时区展示；旧格式文本原样保留。 |
| `media` | `TweetMedia[] \| null`（可选） | 有序媒体。 |
| `quoteUrl` | `string?` | 引用内容缺失或超出深度时的链接。 |
| `warnings` | `string[] \| null`（可选） | 宿主自由文本，原样显示。 |
| `notices` | `TweetNotice[] \| null`（可选） | 可本地化来源限制提示码。 |
| `metrics` | `TweetMetrics?` | 来源统计。 |

`TweetMetrics` 含可选数字 `likes`、`replies`、`reposts`。缺失不展示、不补零，非法和负数忽略。

`TweetNotice = "poll" | "article" | "truncated" | "unsupported-media" | "media-unavailable"`，依次映射到 `poll`、`article`、`incompleteText`、`unsupportedMedia`、`unavailableMedia` 消息。

### 作者类型

`TweetAuthor`：必填 `name: string`、`handle: string`；可选 `url: string`、`avatarUrl: string`、`verification: TweetVerification`、`affiliation: TweetAffiliation`。handle 可带开头的 `@`；省略 URL 时根据合法账号生成 X 主页链接。头像缺失/失败不隐藏作者姓名和账号。

`TweetVerification = "individual" | "business" | "government"`，分别为蓝、金、灰徽章。不能根据显示名称推断认证。

`TweetAffiliation`：必填 `imageUrl: string`，可选 `name: string`、`url: string`。只展示来源明确提供的组织身份，缺少 URL 时徽标不链接。组织关联不同于作者自身认证。

### 正文片段

```ts
type TweetLinkKind = "link" | "mention" | "hashtag";
interface TweetTextSegment { kind: "text"; text: string; url?: never }
interface TweetLinkSegment { kind: TweetLinkKind; text: string; url: string }
type TweetSegment = TweetTextSegment | TweetLinkSegment;
```

片段应按顺序保留全文，包括空格和换行。链接必须提供 URL，不安全地址退回不可导航文本；`text` 中的标记不执行。

### 媒体类型

`TweetMediaMetadata`：可选 `width: number`、`height: number`、`alt: string`。缺少尺寸不阻止内容展示。

| 类型 | 除 `TweetMediaMetadata` 外的字段 |
| --- | --- |
| `TweetPhoto` | `kind: "photo"`，必填原图 `url: string`，可选 `thumbnailUrl: string`。 |
| `PlayableTweetVideo` | `kind: TweetVideoKind`，必填真实播放源 `url: string`，可选 `thumbnailUrl: string`。 |
| `TweetVideoPoster` | `kind: TweetVideoKind`，`url?: never`，必填 `thumbnailUrl: string`。 |
| `TweetVideoKind` | `"video" \| "animated_gif"`。 |
| `TweetVideo` | `PlayableTweetVideo \| TweetVideoPoster`。 |
| `TweetMedia` | `TweetPhoto \| TweetVideo`。 |

不能把封面写成视频 URL。仅封面媒体展示封面与来源链接；animated_gif 使用静音循环视频，不强制自动播放。播放失败仍保留封面/来源入口。

### `TweetMediaRenderers`

```ts
interface TweetMediaRenderers {
  renderPhotos?: (photos: TweetPhoto[]) => ReactNode;
  onOpenPhoto?: (photos: TweetPhoto[], index: number, trigger: HTMLElement) => void;
  renderVideo?: (media: TweetVideo) => ReactNode;
}
```

回调收到已净化的媒体 URL。`renderPhotos` 替换一组**连续照片**，与视频的来源顺序不变；提供后不调用 `onOpenPhoto`。`renderVideo` 替换单个可播放/仅封面视频，使用前先判断 `media.url`。自定义渲染的无障碍和交互由宿主负责。

默认照片保留原图链接。尺寸均已知且过半竖图的多图组使用横向照片条（宽高比限制在 0.4–1.8），其余使用网格，单张保留比例。照片条可聚焦，支持原生键盘滚动、吸附、前后按钮及减少动态效果。`onOpenPhoto` 只接管普通主键点击并保留默认布局；修饰键/中键仍打开链接，`trigger` 可供灯箱关闭后还原焦点。

## 服务端 API

```ts
import { getTweet, parseTweetId, type GetTweetOptions } from "@violetjs/react-tweet/api";
interface GetTweetOptions { signal?: AbortSignal }
function getTweet(id: string, options?: GetTweetOptions): Promise<TweetData>;
function parseTweetId(value: string): string | null;
```

### `parseTweetId`

接受 1–20 位正十进制 ID（无前导零），或 `x.com`、`twitter.com` 及其 `www` / `mobile` 子域上的绝对 HTTP(S) 原文地址。路径为 `/{handle}/status/{id}` 或 `/i/web/status/{id}`，可带 `/photo/{number}` 或 `/video/{number}` 及末尾斜线。查询参数/hash 不影响 ID。危险 URL、其他主机、非默认端口及非法路径返回 `null`，不发起请求。

### `getTweet`

非法 ID/URL 以 `TypeError` 拒绝。从 `https://api.fxtwitter.com/status/{id}` 获取完整正文/媒体，对有来源作者 ID 的可用推文，通过 `https://cdn.syndication.twimg.com/tweet-result` 补充官方作者元数据，包括引用作者。不用官方可能截断的正文覆盖 FxTwitter 全文；来源的 `organization` 认证映射为 `business`。

请求不带凭证且拒绝重定向；不暴露任意来源、认证头、fetch 替换或代理参数。signal 覆盖请求和响应体处理，取消继续抛出，不改写为不可用状态。其他网络、限流、非 JSON、协议错误拒绝 Promise。FxTwitter HTTP/响应 envelope 的 401/403/404 返回 `unavailable`（404 不能证明删除）；syndication 的 401/403/404 仅跳过元数据补充，不丢弃已有可用快照。明确 tombstone/私密标记可返回 `deleted` / `private`，syndication 墓碑返回 `unavailable`。官方推文和作者 ID 匹配时，即使账号改名也能阻止私密快照显示；账号一致性约束公开元数据补充。

仅服务端调用，syndication 不开放浏览器 CORS。超时、缓存、重试、端点认证、代理配置均由宿主负责；API 不返回 React 元素或加载 CSS，依赖图无 React 运行时导入。使用 Node 环境代理时，需要支持 `NODE_USE_ENV_PROXY=1` 的 Node 版本，并通过 `NO_PROXY` 排除本地服务；仅设置代理环境变量并非在所有 Node 版本都有效。

## 样式

卡片 `width: 100%`、`min-width: 0`，不设固定/默认最大宽度。用外层容器或原生 `className` / `style` 控制。默认跟随系统；祖先 `.light` / `.dark`、`[data-theme="light"]` / `[data-theme="dark"]` 可选主题，卡片自身也支持 `data-theme`。不要嵌套互相冲突的主题祖先并假设最近祖先优先。

| 公开 CSS 变量 | 用途 |
| --- | --- |
| `--tweet-background` | 卡片背景。 |
| `--tweet-foreground` | 正文/姓名。 |
| `--tweet-muted` | 次级文字。 |
| `--tweet-border` | 卡片/媒体边框。 |
| `--tweet-surface` | 头像回退等次级表面。 |
| `--tweet-accent` | 链接/操作。 |
| `--tweet-accent-hover` | 链接悬停。 |
| `--tweet-focus` | focus-visible 描边。 |
| `--tweet-like-hover` | 点赞悬停色。 |
| `--tweet-reply-hover` | 回复悬停色。 |
| `--tweet-repost-hover` | 转发悬停色。 |
| `--tweet-verified` | 个人认证色。 |
| `--tweet-font-family` | 字体。 |
| `--tweet-radius` | 卡片圆角，默认 12px、上限 16px。 |

宿主可选 token（`--card`、`--card-foreground`、`--muted-foreground`、`--border`、`--muted`、`--ring`）参与回退，但均非必需。内部 `--_tweet-*` 不是自定义 API。默认内边距 16px 20px，紧凑/引用与移动端各有调整。CSS 所需 SVG 随包发布，应保留相对资源路径或由构建工具重写，无需 SVG loader。

根入口与 CSS 标记为有副作用，生产 tree shaking 保留默认样式；`/unstyled`、`/api` 不导入 CSS。普通 Node 必须使用 `/unstyled` 而不是带样式根入口。类型入口不导入 CSS，无需消费方额外声明 CSS 模块。
