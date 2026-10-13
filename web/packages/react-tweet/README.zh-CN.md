# @violetjs/react-tweet

[English](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/README.md) · [完整 API](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/docs/api.zh-CN.md) · [示例源码](https://github.com/VOD-Studio/violet/tree/release/2.0/web/packages/react-tweet/examples)

原生 React 推文卡片，支持明暗主题、已保存快照、无障碍媒体与服务端 FxTwitter 适配器。不依赖 iframe、第三方脚本、路由、状态库或 Tailwind；图片和视频仍会请求各自的资源地址。

![同一条虚构推文的明暗主题](https://raw.githubusercontent.com/VOD-Studio/violet/release/2.0/web/packages/react-tweet/docs/images/tweet-zh.png)

## 安装

```sh
pnpm add @violetjs/react-tweet react
```

需要 React 19 与 ESM 构建工具。默认样式使用现代 CSS（`light-dark`、`color-mix`、CSS mask）。服务端适配器需要标准 `fetch` 与 `AbortSignal` API。

## 展示已保存的推文

`EmbeddedTweet` 不请求推文数据。传入快照即可，只填写来源确实提供的信息。

<!-- example:snapshot:start -->
```tsx
import { EmbeddedTweet, type TweetData } from "@violetjs/react-tweet";

export const saved: TweetData = {
	url: "https://x.com/sketchbook_demo/status/1834000000000000002",
	availability: "available",
	snapshot: {
		author: { name: "Mira Chen", handle: "sketchbook_demo", verification: "individual" },
		text: "Finished our sketchbook zine. Every page starts with a little ink.",
		publishedAt: "2026-09-14T09:30:00.000Z",
		metrics: { likes: 1284, replies: 46, reposts: 212 },
	},
};

export function Snapshot() {
	return <EmbeddedTweet tweet={saved} />;
}
```
<!-- example:snapshot:end -->

作者、账号、ID 和内容均为虚构示例，不代表真实推文或背书。私密、删除及不可用内容应使用对应的 `availability`，不得携带 `snapshot` 或 `quotedTweet`。

## 选择主题

下面就是首图使用的组件，前一个示例保存为 `snapshot.tsx`。中文首图用 `<Themes locale="zh-CN" />` 调用：本地化只改变界面文案与数字日期，不翻译作者正文。卡片填满容器，不设最大宽度；1000px 并排画布只用于此示例，不是页面布局要求。

<!-- example:themes:start -->
```tsx
import { EmbeddedTweet } from "@violetjs/react-tweet";
import { saved } from "./snapshot";

export function Themes({ locale = "en-US" }: { locale?: string }) {
	return (
		<div style={{ display: "flex", gap: 20, padding: 20, width: 1000, background: "#f0f1f3" }}>
			<EmbeddedTweet tweet={saved} data-theme="light" locale={locale} />
			<EmbeddedTweet tweet={saved} data-theme="dark" locale={locale} />
		</div>
	);
}
```
<!-- example:themes:end -->

不指定时跟随系统，也支持祖先的 `.light` / `.dark`、`data-theme="light"` / `"dark"`。可覆盖 `--tweet-background`、`--tweet-foreground`、`--tweet-accent` 等 [CSS 变量](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/docs/api.zh-CN.md#样式)适配自己的站点。

## 嵌入引用小卡片

用 `quoted` 把已保存推文放进聊天消息或其他内容中。先把第一个示例保存为 `snapshot.tsx`。

<!-- example:quoted:start -->
```tsx
import { EmbeddedTweet } from "@violetjs/react-tweet";
import { saved } from "./snapshot";

export function QuotedPost() {
	return <EmbeddedTweet tweet={saved} quoted />;
}
```
<!-- example:quoted:end -->

小卡片缩小头像和字号，隐藏 X 标识与互动数，正文超过四行时可展开。`maxTextLines={0}` 保持全文可见。照片显示为方形缩略图拼图，有封面的视频链接到原文。嵌套引用自动使用相同布局。`compact` 只调整内边距，`quoted` 选择小卡片布局。

## 通过自己的服务端加载

由宿主 API client、缓存或 server function 提供稳定的 `TweetFetcher`。签名是 `(id, { signal }) => Promise<TweetData>`；端点和认证由宿主决定。

<!-- example:remote:start -->
```tsx
import { Tweet, type TweetFetcher } from "@violetjs/react-tweet";

export function RemoteTweet({ fetcher }: { fetcher: TweetFetcher }) {
	return <Tweet id="1834000000000000002" fetcher={fetcher} />;
}
```
<!-- example:remote:end -->

`Tweet` 挂载后加载，等待时显示骨架；取消旧请求、丢弃迟到结果，错误后提供手动重试。不自动重抓明确私密、删除或不可用的结果。SSR 时只输出加载态，不输出推文正文。

## 服务端获取与渲染

用真实推文 ID 或 X/Twitter 原文地址调用下面的函数。此示例需安装 `react-dom`。`/unstyled` 避免 Node.js 导入 CSS；浏览器的样式入口另行导入 `@violetjs/react-tweet/styles.css`。

<!-- example:server:start -->
```tsx
import { getTweet } from "@violetjs/react-tweet/api";
import { EmbeddedTweet } from "@violetjs/react-tweet/unstyled";
import { renderToStaticMarkup } from "react-dom/server";

export async function renderPost(id: string, signal?: AbortSignal) {
	const tweet = await getTweet(id, { signal });
	return renderToStaticMarkup(<EmbeddedTweet tweet={tweet} locale="en-US" timeZone="UTC" />);
}
```
<!-- example:server:end -->

`getTweet` 从 FxTwitter 获取完整正文和媒体，再用 X syndication 补充作者元数据。**只在服务端调用**：官方元数据服务不开放浏览器 CORS。运行环境必须能访问两个来源；宿主处理失败与限流。包不内置缓存或自动重试，也可直接用任意来源适配成 `TweetData`。

服务端获取数据不会代理媒体地址。浏览器发送第三方 `Referer` 时，直接请求 `video.twimg.com` 的播放源可能失败；组件会回退到封面与「在 X 查看视频」。需要播放时，由自己的服务端代理提供浏览器可访问的媒体地址，或用 `renderVideo` 接入宿主播放器与媒体服务。包不提供媒体代理。

## 组合自己的卡片

`TweetCard` 只提供布局，不添加 X 品牌、来源链接或操作。

<!-- example:card:start -->
```tsx
import { TweetCard } from "@violetjs/react-tweet";

export function Note() {
	return (
		<TweetCard
			aria-label="Studio note"
			headerSlot={<strong>Ink Club</strong>}
			contentSlot={<p>Bring a sketchbook. We will bring the coffee.</p>}
			footerSlot={<time dateTime="2026-10-16">October 16, 2026</time>}
		/>
	);
}
```
<!-- example:card:end -->

## 入口

| 导入 | 用途 |
| --- | --- |
| `@violetjs/react-tweet` | 组件与公开类型，自动加载默认 CSS，交给支持 CSS 的构建工具。 |
| `@violetjs/react-tweet/unstyled` | 同一组组件和类型，无 CSS 导入，适用于 Node SSR 或自定义样式。 |
| `@violetjs/react-tweet/api` | `getTweet`、`parseTweetId`、`GetTweetOptions`，不依赖 React/CSS。 |
| `@violetjs/react-tweet/styles.css` | 为 unstyled 入口手动加载默认样式，包含 SVG 图标资源。 |
| `@violetjs/react-tweet/package.json` | 包元数据。 |

## 展示与交互

- `locale="en-US"`、`timeZone="UTC"` 是确定性默认值。内置英文和简体中文，`messages` 可覆盖；不翻译作者正文。
- 正文默认折叠为六行，引用小卡片最多四行。`maxTextLines={0}` 关闭折叠；引用独立展开，SSR 保留全文。
- 单张照片按自身比例靠起始侧对齐，多张使用网格或竖图横条。横条按钮逐张切换。
- 视频先展示封面与播放按钮，开始后显示原生控件；读取到元数据时显示时长。GIF 静音循环，可见时可自动播放，尊重减少动态效果偏好和手动暂停。连续视频与 GIF 共用横条。
- `onOpenPhoto` 接入灯箱并保留布局，`renderPhotos` / `renderVideo` 完全替换媒体展示。
- 引用展开一层；不可用内容不泄露残留快照。链接和媒体地址经过净化，正文不作为 HTML 解析。
- 保留原生 article 属性、`ref`、样式和事件。点赞、回复打开 X 的真实操作入口，计数是快照，不伪造站内交互结果。

所有属性、数据类型、消息键、样式变量和网络边界见 [完整 API 文档](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/docs/api.zh-CN.md)。

## 许可

[MIT](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/LICENSE)。认证徽章几何包含 Luis Alvarez 的 MIT 授权作品，已保留署名。本包不隶属于 X 或 FxTwitter。
