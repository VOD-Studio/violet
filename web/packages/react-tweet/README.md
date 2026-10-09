# @violet/react-tweet

原生 React 推文组件，包含快照渲染、异步加载、来源无关的组合卡片和服务端数据适配器。不依赖 Violet 站点、路由、状态管理或 Tailwind，不加载第三方脚本或 iframe；图片、视频仍会请求各自的资源地址。

## 安装与入口

当前包仅在 workspace 内使用，尚未发布 npm。可在工作区的 `web/` 目录生成 tarball，再在独立项目安装：

```bash
pnpm --dir packages/react-tweet pack --pack-destination /tmp
# 在消费项目执行；React 19 由宿主提供。
pnpm add /tmp/violet-react-tweet-0.1.0.tgz
```

| 入口 | 契约 |
| --- | --- |
| `@violet/react-tweet` | 组件与公开类型，自动导入 CSS；由支持 CSS 的浏览器构建工具消费 |
| `@violet/react-tweet/unstyled` | 同一组件和类型，无 CSS 副作用；可直接用于 Node.js SSR 或自定义样式 |
| `@violet/react-tweet/api` | `getTweet`、`parseTweetId`、`GetTweetOptions`；不依赖 React 或 CSS |
| `@violet/react-tweet/styles.css` | 无样式入口需要默认外观时手动加载 |

运行环境需要 React 19、原生 ESM、现代浏览器 CSS 和标准 Fetch API。根入口与 `/unstyled` 共用无 CSS 的类型入口，读取类型不需要额外声明 CSS 模块。

## 渲染已保存的快照

`EmbeddedTweet` 不发起数据请求，适合宿主已保存的快照和服务端渲染。

```tsx
import { EmbeddedTweet, type TweetData } from "@violet/react-tweet";

const saved: TweetData = {
  url: "https://x.com/thsottiaux/status/2062329981548802523",
  availability: "available",
  snapshot: {
    author: { name: "Tibo", handle: "thsottiaux" },
    text: "Hi. Over the last 24 hours we had three separate small incidents that affected Codex reliability. Those are three too many and we are taking active steps for them to not reproduce.\n\nI have reset usage limits for Codex across all paid plans. May the tokens flow again.",
  },
};

export function SavedTweet() {
  return <EmbeddedTweet tweet={saved} locale="zh-CN" timeZone="Asia/Shanghai" />;
}
```

`TweetData` 按 `availability` 判别：`available` 必须包含快照；`private`、`deleted`、`unavailable` 禁止携带正文与引用。宿主标记不可用的内容只展示来源入口，不向外站重新抓取。

## 异步加载

`Tweet.fetcher` 必填，接入方式由宿主决定，可使用同源端点、server function 或缓存。下面的包装组件接收宿主已经实现的加载器，不假定端点路径或响应封装：

```tsx
import { Tweet, type TweetFetcher } from "@violet/react-tweet";

export function RemoteTweet({ fetcher }: { fetcher: TweetFetcher }) {
  return (
    <Tweet
      id="1728987032779694397"
      fetcher={fetcher}
      locale="zh-CN"
      timeZone="Asia/Shanghai"
    />
  );
}
```

加载器签名为 `(id, { signal }) => Promise<TweetData>`。`Tweet` 在客户端挂载后调用它；ID、加载器变化或卸载时取消旧请求并丢弃迟到结果。加载时显示头像、作者、正文和底栏骨架，`messages.loading` 只向屏幕阅读器报告状态；减少动态效果时骨架不播放动画。暂时失败提供原文入口与手动重试，不自动重抓明确不可用内容。

需要 SSR 正文时，在服务端调用 `getTweet`，再把结果传给 `EmbeddedTweet`：

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { getTweet } from "@violet/react-tweet/api";
import { EmbeddedTweet } from "@violet/react-tweet/unstyled";

const tweet = await getTweet("1728987032779694397");
const html = renderToStaticMarkup(
  <EmbeddedTweet tweet={tweet} locale="zh-CN" timeZone="Asia/Shanghai" />,
);
```

该示例使用 `/unstyled` 避免 Node.js 直接加载 CSS；浏览器页面需另行加载 `@violet/react-tweet/styles.css`。

官方作者元数据不开放浏览器跨域访问，**不要在浏览器中直接调用 `getTweet`**。

## 组合非 X 内容与引用

`TweetCard` 只负责外观和内容顺序，不要求 X 标识，也不添加外站品牌、链接或操作。通过 `headerSlot`、`contentSlot`、`mediaSlot`、`quoteSlot`、`footerSlot` 组合宿主内容。`EmbeddedTweet` 内部复用同一个布局。

```tsx
import { TweetCard } from "@violet/react-tweet";

export function QuotedPost() {
  return (
    <TweetCard
      aria-label="林的推文"
      headerSlot={<header><strong>林</strong></header>}
      contentSlot={<p>补充一条阅读记录，引用原作者的说明。</p>}
      quoteSlot={
        <TweetCard
          compact
          isQuoted
          aria-label="周的原推文"
          headerSlot={<header><strong>周</strong></header>}
          contentSlot={<p>组件随父容器伸展，页面决定它在版面中占据多宽。</p>}
          footerSlot={<time dateTime="2026-10-06">2026 年 10 月 6 日</time>}
        />
      }
    />
  );
}
```

`isQuoted` 标记嵌套的原推文，不是一个独立的空白提示条。引用态保持相同底色，通过细边框、较小头像、紧凑作者信息和 14px 正文区分层级；`compact` 只调整内边距。

所有卡片均为 `width: 100%`、`min-width: 0`，**组件不设置固定宽度或默认最大宽度**。普通、紧凑、引用、加载与错误状态遵循同一宽度契约；引用卡片填满父卡片的内容区。页面可用自己的布局容器或原生 `className` / `style` 控制宽度，无需覆盖包内 CSS 变量。

## 内容、媒体与交互

- 照片必须有原图地址；视频区分真实播放源与仅封面状态，不将图片 URL 当作视频。照片与视频之间保持来源顺序；引用最多展开一层，更深层保留原文链接。
- 连续照片的默认展示与 X 原帖一致：**竖图为主的多张照片**（每张都带宽高、过半为竖图）用横向滚动条，各卡片同高、宽度取各自的宽高比（钳制在 0.4 到 1.8），露出下一张的边缘提示可以滑动，悬停或聚焦时出现前后按钮，按一张卡片的宽度滚动并吸附对齐，触屏设备按钮常驻；其余情况（横图为主、含缺少宽高的照片）用方格，单张保持原比例。滚动区域可聚焦，方向键即可横向滚动，减少动态效果时不做平滑滚动。
- `onOpenPhoto(photos, index, trigger)` 在保留上述默认布局的前提下接管点击，用于接入宿主灯箱；按住修饰键或中键点击仍按链接另页打开原图。`renderPhotos` 接收净化后的连续照片组并全权负责展示，提供它时 `onOpenPhoto` 不会被调用；`renderVideo` 接收一项可播放或仅封面的媒体。照片插槽可以接入灯箱，portal 键盘事件仍可到达宿主。
- 滚动条的可访问名称与按钮文案由 `messages.photoRail`、`messages.previousPhotos`、`messages.nextPhotos` 提供。
- 组件保留原生 `article` 的 `ref`、`className`、`style`、ARIA、`data-*` 和事件；正文仍冒泡，链接与媒体独立交互。`children` 和 `dangerouslySetInnerHTML` 不开放；异步组件的 `id` 专用于来源标识。
- `Tweet` 与 `EmbeddedTweet` 默认将正文限制为 6 行；外层与嵌套引用分别提供「展示更多／收起」，互不联动，不折叠媒体或操作。`maxTextLines` 可调整行数，`maxTextLines={0}` 展示全文；非正整数关闭折叠。SSR 保留完整文字与链接并直接应用折叠样式，浏览器测量后只为实际溢出的正文显示按钮；宽度或字体改变会重新判断。文案通过 `messages.showMore` / `messages.showLess` 覆盖。
- X 快照的统计与发布时间共用底栏，按点赞、回复、转发排列。点赞与回复在新标签页打开 X 的真实操作入口，不伪造计数变化；转发数是只读快照。右上角 X 标记与时间链接打开原文。

## 本地化与外观

`locale` 默认 `en-US`，`timeZone` 默认 `UTC`；不读取浏览器语言或服务器本地时区。内置英文、简体中文，`messages` 可覆盖全部界面文案与无障碍标签；其他语言可传入完整词典。原作者正文和宿主自由文本提示不翻译。高精度 ISO 时间戳按显式时区格式化，同时保留原始 `datetime`。

支持 `.dark` / `.light`、`data-theme` 与系统色彩偏好。以下 CSS 变量可覆盖默认外观：

| 用途 | 变量 |
| --- | --- |
| 基础颜色 | `--tweet-background`、`--tweet-foreground`、`--tweet-muted`、`--tweet-border`、`--tweet-surface` |
| 链接与焦点 | `--tweet-accent`、`--tweet-accent-hover`、`--tweet-focus` |
| 操作悬停色 | `--tweet-like-hover`、`--tweet-reply-hover`、`--tweet-repost-hover` |
| 认证与排版 | `--tweet-verified`、`--tweet-font-family`、`--tweet-radius` |

功能圆角上限为 16px。普通链接悬停提亮链接色，不切换成正文色。作者姓名、账号、头像与组织关联各自导航，不共用整行 hover；姓名悬停只显示下划线并保留原文字颜色，账号与操作入口只改变自身颜色。点赞、回复、转发分别使用玫红、蓝色、绿色悬停反馈，暗色主题使用对应亮色。

`author.verification` 区分 `individual` / `business` / `government`，分别显示蓝色、金色、灰色认证徽章；`author.affiliation` 只展示来源明确提供的组织图片与链接，不根据账号猜测关系。

SVG 图标位于 `src/tweet/icons/*.svg`。品牌、操作和单色徽章通过 CSS mask 随文字颜色变化，企业徽章保留 SVG 渐变；构建复制同一组资源到 `dist/tweet/icons/`，不要求宿主配置 SVG 模块加载器。手机上的普通、紧凑与引用卡片分别保持 16px、14px、12px 内边距。

## 服务端数据与网络边界

`getTweet` 在服务端读取 [FxTwitter Status Fetch API](https://github.com/FxEmbed/FxEmbed/wiki/Status-Fetch-API) 的完整正文与媒体，再由 X 官方 syndication 补充作者认证和组织关联，不用官方可能截断的正文覆盖长文。

官方推文 ID 与作者 ID 匹配后，私密状态立即阻止旧正文展示，作者改名不会绕过此检查；账号一致性只约束公开作者元数据的补充。FxTwitter 的 `organization` 认证映射为组件的 `business`。普通推文与长推文的索引口径不同，适配器统一后再切片，避免中文和 emoji 截断。

外部服务可能限流或不可用，网络与协议错误交给宿主处理。请求固定来源、不携带凭证、不跟随重定向；请求或响应体读取后检查取消，不将取消改写为不可用状态。

服务端必须能访问两处外部来源。若通过 `HTTP_PROXY` / `HTTPS_PROXY` 出网，使用支持内置代理的 Node.js 版本并启用 `NODE_USE_ENV_PROXY=1`，同时通过 `NO_PROXY` 排除宿主本地 API。旧版 Node.js 的原生 `fetch` 不会仅因设置这些代理变量就自动使用代理。代理属于宿主运行环境配置，不进入浏览器组件。

## 开发、构建与发布验证

- `src/data/`：数据、媒体、异步加载契约与 URL 校验，不依赖 React。
- `src/fxtwitter/`：完整正文与媒体请求、规范化，以及作者元数据合并。
- `src/syndication/`：官方作者认证、组织关联和可见性校验。
- `src/tweet/`：展示组件、私有加载 hook、本地化、媒体渲染接口、CSS 与独立 SVG 资源。
- `src/index.ts`、`src/unstyled.ts`、`src/api.ts`、`src/styles.css`：公开入口；内部模块直接引用具体文件，不反向依赖入口 barrel。测试与被测模块共置。

源码相对导入使用实际 `.ts` / `.tsx` 扩展名。TypeScript 的 `rewriteRelativeImportExtensions` 在构建时将运行时路径改为 `.js`，发布的 ESM 可直接由 Node.js 执行。

在 workspace 的 `web/` 目录执行：

```bash
pnpm --filter @violet/react-tweet typecheck
pnpm --filter @violet/react-tweet test
pnpm --filter @violet/react-tweet build
pnpm --dir packages/react-tweet pack --pack-destination /tmp
```

发布前需在 workspace 外安装真实 tarball，验证 Node.js SSR、浏览器默认 CSS、全部 SVG 资源、容器宽度、纯 API 依赖边界与跨运行时水合，而非只检查源码路径。发布包包含构建产物、本文档与 MIT 许可证。

根入口自动加载 CSS 依赖 `sideEffects` 同时保留源码入口 `src/index.ts`、发布入口 `dist/index.js` 与 CSS 文件；`/unstyled` 和 `/api` 不包含样式副作用。浏览器验收须使用生产构建，从根入口具名导入组件且不额外导入 CSS，确认头像、作者布局、卡片与媒体的默认样式生效。
