# @violetjs/react-tweet

[简体中文](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/README.zh-CN.md) · [API reference](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/docs/api.md) · [Examples](https://github.com/VOD-Studio/violet/tree/release/2.0/web/packages/react-tweet/examples)

Native React tweet cards with light and dark themes, saved snapshots, accessible media, and a server-side FxTwitter adapter. No iframe, third-party script, router, state library, or Tailwind dependency. Images and videos still load from their supplied URLs.

![The same fictional post in light and dark themes](https://raw.githubusercontent.com/VOD-Studio/violet/release/2.0/web/packages/react-tweet/docs/images/tweet-en.png)

## Install

```sh
pnpm add @violetjs/react-tweet react
```

Requires React 19 and an ESM-compatible toolchain. Default styling uses modern CSS (`light-dark`, `color-mix`, CSS masks). The server adapter requires a runtime with standard `fetch` and `AbortSignal` APIs.

## Render a saved post

`EmbeddedTweet` never fetches post data. Pass a saved snapshot, including only the information your source actually provides.

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

The author, account, ID, and text above are fictional demo data, not an endorsement or a live post. A private, deleted, or otherwise unavailable post must use its corresponding `availability` without `snapshot` or `quotedTweet`.

## Choose a theme

This is the exact component used for the preview above. Save the previous example as `snapshot.tsx`. Each card fills its container; the library imposes no maximum width. The 1000px side-by-side canvas is only for this illustration, not a required page layout.

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

Without an override, the theme follows the system. Ancestor `.light` / `.dark` classes and `data-theme="light"` / `"dark"` are supported. Override `--tweet-background`, `--tweet-foreground`, `--tweet-accent`, and other [CSS variables](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/docs/api.md#styling) to match your site.

## Load through your own server

Supply a stable `TweetFetcher` from your application's API client, cache, or server function. It receives `(id, { signal })` and resolves to `TweetData`; your endpoint and authentication stay under your control.

<!-- example:remote:start -->
```tsx
import { Tweet, type TweetFetcher } from "@violetjs/react-tweet";

export function RemoteTweet({ fetcher }: { fetcher: TweetFetcher }) {
	return <Tweet id="1834000000000000002" fetcher={fetcher} />;
}
```
<!-- example:remote:end -->

`Tweet` fetches after client mount, shows a skeleton, cancels superseded requests, ignores late results, and offers manual retry after errors. Known private/deleted/unavailable results are not automatically refetched. It renders a loading state, not post content, during SSR.

## Fetch and render on the server

Call this function with a real post ID or X/Twitter status URL. Install `react-dom` for this server-rendering example. The `/unstyled` entry avoids importing CSS into Node.js; load `@violetjs/react-tweet/styles.css` in the browser's stylesheet entry.

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

`getTweet` fetches full text and media from FxTwitter and supplements author metadata using X syndication. **Run it on your server**, not directly in a browser: the metadata service does not allow browser CORS. Both services must be reachable; failures and rate limits must be handled by your application. There is no built-in cache or automatic retry. Saved data can instead come from any source matching `TweetData`.

## Compose your own card

`TweetCard` provides layout without adding X branding, links, or actions.

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

## Entries

| Import | Purpose |
| --- | --- |
| `@violetjs/react-tweet` | Components and public types; automatically imports default CSS. Use a CSS-aware bundler. |
| `@violetjs/react-tweet/unstyled` | The same components and types with no CSS import; for Node SSR or custom styles. |
| `@violetjs/react-tweet/api` | `getTweet`, `parseTweetId`, and `GetTweetOptions`; no React or CSS dependency. |
| `@violetjs/react-tweet/styles.css` | Default styles, including bundled SVG icons, for the unstyled entry. |
| `@violetjs/react-tweet/package.json` | Package metadata. |

## Display and interaction

- `locale="en-US"` and `timeZone="UTC"` are deterministic defaults. Built-in English and Simplified Chinese UI strings can be overridden with `messages`; source text is never translated.
- Body text defaults to six lines. Use `maxTextLines={0}` to disable collapsing; quotes expand independently. SSR retains the full text.
- Photos use a grid or a horizontal rail for portrait-heavy groups. `onOpenPhoto` connects your lightbox without replacing the layout; `renderPhotos` and `renderVideo` replace media rendering entirely.
- Quotes expand one level. Unavailable content never reveals a stale snapshot. Links and media URLs are sanitized, not interpreted as HTML.
- Native article attributes, `ref`, styles, and events are preserved. Like and reply links open real X actions; displayed counts are snapshots, not locally simulated engagement.

See the [complete API reference](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/docs/api.md) for every prop, data type, message key, styling variable, and network boundary.

## License

[MIT](https://github.com/VOD-Studio/violet/blob/release/2.0/web/packages/react-tweet/LICENSE). The verification icon geometry includes Luis Alvarez's MIT-licensed work; its attribution is retained. This package is not affiliated with X or FxTwitter.
